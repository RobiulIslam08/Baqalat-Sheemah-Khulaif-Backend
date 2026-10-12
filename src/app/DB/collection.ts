import crypto from 'crypto';
import { getDatabase, markDirty, runOp } from './sqlite';
import { isMySQLActive, saveRowToMySQL } from './mysql';

export type DocMethods = Record<string, (this: Doc, ...args: never[]) => unknown>;

export interface CollectionOptions {
  softDelete?: boolean;
  hidden?: string[];
  refs?: Record<string, string>;
  methods?: Record<string, (this: Doc, ...args: any[]) => unknown>;
  beforeSave?: (data: Record<string, any>, previous: Record<string, any> | null) => Promise<void> | void;
}

export class Doc {
  [key: string]: any;

  constructor(collection: string, data: Record<string, any>, methods?: CollectionOptions['methods']) {
    Object.defineProperty(this, '__collection', { value: collection, enumerable: false });
    Object.assign(this, data);
    if (methods) {
      for (const [name, fn] of Object.entries(methods)) {
        Object.defineProperty(this, name, { value: fn, enumerable: false });
      }
    }
  }

  toJSON() {
    const hidden = registry.get(this.__collection)?.hidden ?? [];
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this)) {
      if (hidden.includes(key)) continue;
      out[key] = value;
    }
    return out;
  }

  async save() {
    const collection = registry.get(this.__collection);
    if (!collection) throw new Error(`Unknown collection ${this.__collection}`);
    return collection.saveDoc(this);
  }
}

function plainFrom(doc: Doc): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (typeof value === 'function') continue;
    out[key] = value;
  }
  return out;
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === 'number' && typeof b === 'string' && b.trim() !== '') return a === Number(b);
  if (typeof b === 'number' && typeof a === 'string' && a.trim() !== '') return Number(a) === b;
  if (typeof a === 'boolean' || typeof b === 'boolean') return String(a) === String(b);
  return false;
}

function toTime(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : time;
  }
  return null;
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const ta = toTime(a);
  const tb = toTime(b);
  if (ta != null && tb != null) return ta - tb;
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
}

function mentions(filter: unknown, key: string): boolean {
  if (!filter || typeof filter !== 'object') return false;
  return JSON.stringify(filter).includes(`"${key}"`);
}

function matches(doc: Record<string, any>, filter: any): boolean {
  if (!filter || typeof filter !== 'object' || filter instanceof RegExp) return true;
  for (const [key, cond] of Object.entries(filter)) {
    if (key === '$or') {
      if (!(cond as any[]).some((item) => matches(doc, item))) return false;
      continue;
    }
    if (key === '$and') {
      if (!(cond as any[]).every((item) => matches(doc, item))) return false;
      continue;
    }
    const value = doc[key];
    if (cond instanceof RegExp) {
      if (!cond.test(String(value ?? ''))) return false;
      continue;
    }
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
      const operator = cond as Record<string, any>;
      if ('$ne' in operator && looseEqual(value, operator.$ne)) return false;
      if ('$gte' in operator && compareValues(value, operator.$gte) < 0) return false;
      if ('$gt' in operator && compareValues(value, operator.$gt) <= 0) return false;
      if ('$lte' in operator && compareValues(value, operator.$lte) > 0) return false;
      if ('$lt' in operator && compareValues(value, operator.$lt) >= 0) return false;
      if ('$in' in operator && !(operator.$in as unknown[]).some((item) => looseEqual(value, item))) {
        return false;
      }
      if ('$regex' in operator) {
        const flags = String(operator.$options || '').includes('i') ? 'i' : '';
        const regex = operator.$regex instanceof RegExp ? operator.$regex : new RegExp(String(operator.$regex), flags);
        if (!regex.test(String(value ?? ''))) return false;
      }
      continue;
    }
    if (!looseEqual(value, cond)) return false;
  }
  return true;
}

function parseSort(spec: unknown): Array<{ field: string; dir: number }> {
  if (!spec) return [{ field: 'createdAt', dir: -1 }];
  if (typeof spec === 'string') {
    return spec
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => (part.startsWith('-') ? { field: part.slice(1), dir: -1 } : { field: part, dir: 1 }));
  }
  if (typeof spec === 'object') {
    return Object.entries(spec as Record<string, unknown>).map(([field, dir]) => ({
      field,
      dir: Number(dir) >= 0 ? 1 : -1,
    }));
  }
  return [{ field: 'createdAt', dir: -1 }];
}

export class Query {
  filters: any[] = [];
  sortSpec: unknown = null;
  skipCount = 0;
  limitCount: number | null = null;
  selectSpec: string | null = null;
  populateFields: string[] = [];
  includeHidden = false;
  asLean = false;
  projection: string | null = null;

  constructor(
    public collection: Collection,
    filter?: any,
    public single = false,
  ) {
    if (filter && Object.keys(filter).length) this.filters.push(filter);
  }

  find(filter: any) {
    if (filter) this.filters.push(filter);
    return this;
  }

  sort(spec: unknown) {
    this.sortSpec = spec;
    return this;
  }

  skip(count: number) {
    this.skipCount = count;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  select(spec: string) {
    this.selectSpec = spec;
    if (spec.includes('+')) this.includeHidden = true;
    return this;
  }

  populate(field: string) {
    this.populateFields.push(field);
    return this;
  }

  session(_session?: unknown) {
    return this;
  }

  lean() {
    this.asLean = true;
    return this;
  }

  getFilter() {
    if (this.filters.length === 0) return {};
    if (this.filters.length === 1) return this.filters[0];
    return { $and: this.filters };
  }

  get model() {
    return this.collection;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.exec().then(onfulfilled, onrejected);
  }

  async exec(): Promise<any> {
    return runOp(async () => this.execSync());
  }

  execSync(): any {
    const filter = this.getFilter();
    let rows = this.collection.readAll().filter((row) => {
      if (this.collection.softDelete && row.isDeleted === true && !mentions(filter, 'isDeleted')) return false;
      return matches(row, filter);
    });

    const sort = parseSort(this.sortSpec);
    rows.sort((a, b) => {
      for (const rule of sort) {
        const diff = compareValues(a[rule.field], b[rule.field]) * rule.dir;
        if (diff !== 0) return diff;
      }
      return 0;
    });

    if (!this.single) {
      if (this.skipCount) rows = rows.slice(this.skipCount);
      if (this.limitCount != null) rows = rows.slice(0, this.limitCount);
    } else {
      rows = rows.slice(0, 1);
    }

    let docs = rows.map((row) => this.hydrate(row));
    for (const field of this.populateFields) {
      const targetName = this.collection.refs[field];
      const target = targetName ? registry.get(targetName) : undefined;
      docs = docs.map((doc) => {
        const id = doc[field];
        if (target && typeof id === 'string') {
          const related = target.readAll().find((item) => item._id === id && item.isDeleted !== true) ?? null;
          doc[field] = related ? this.presentRelated(related, target) : null;
        }
        return doc;
      });
    }

    if (this.single) return docs[0] ?? null;
    return docs;
  }

  private hydrate(row: Record<string, any>) {
    const copy = this.project({ ...row });
    if (this.asLean) return copy;
    return new Doc(this.collection.name, copy, this.collection.methods);
  }

  private presentRelated(row: Record<string, any>, collection: Collection) {
    const copy = { ...row };
    for (const field of collection.hidden) delete copy[field];
    return copy;
  }

  private project(row: Record<string, any>) {
    const spec = [this.projection, this.selectSpec].filter(Boolean).join(' ');
    const parts = spec.split(/\s+/).filter(Boolean);
    const include = parts.filter((part) => !part.startsWith('-') && !part.startsWith('+'));
    const exclude = parts.filter((part) => part.startsWith('-')).map((part) => part.slice(1));
    const force = parts.filter((part) => part.startsWith('+')).map((part) => part.slice(1));

    if (include.length) {
      const picked: Record<string, any> = { _id: row._id };
      for (const field of include) picked[field] = row[field];
      for (const field of force) picked[field] = row[field];
      return picked;
    }

    for (const field of exclude) delete row[field];
    if (!this.includeHidden) {
      for (const field of this.collection.hidden) {
        if (!force.includes(field)) delete row[field];
      }
    }
    return row;
  }
}

export class Collection {
  name: string;
  softDelete: boolean;
  hidden: string[];
  refs: Record<string, string>;
  methods?: CollectionOptions['methods'];
  beforeSave?: CollectionOptions['beforeSave'];

  constructor(name: string, options: CollectionOptions = {}) {
    this.name = name;
    this.softDelete = Boolean(options.softDelete);
    this.hidden = options.hidden ?? [];
    this.refs = options.refs ?? {};
    this.methods = options.methods;
    this.beforeSave = options.beforeSave;
    registry.set(name, this);
  }

  find(filter?: any, projection?: string) {
    const query = new Query(this, filter, false);
    if (typeof projection === 'string') query.projection = projection;
    return query;
  }

  findOne(filter?: any) {
    return new Query(this, filter, true);
  }

  findById(id: string) {
    return new Query(this, { _id: id }, true);
  }

  create(payload: any[], options?: { session?: unknown }): Promise<Doc[]>;
  create(payload: Record<string, any>, options?: { session?: unknown }): Promise<Doc>;
  async create(payload: any, _options?: { session?: unknown }): Promise<any> {
    return runOp(async () => {
      if (Array.isArray(payload)) {
        const created = [];
        for (const item of payload) created.push(await this.insertSync(item));
        return created;
      }
      return this.insertSync(payload);
    });
  }

  async countDocuments(filter: any = {}) {
    return runOp(async () => {
      return this.readAll().filter((row) => {
        if (this.softDelete && row.isDeleted === true && !mentions(filter, 'isDeleted')) return false;
        return matches(row, filter);
      }).length;
    });
  }

  async findByIdAndUpdate(id: string, update: any, _options?: unknown) {
    return this.findOneAndUpdate({ _id: id }, update);
  }

  async findOneAndUpdate(filter: any, update: any, _options?: unknown) {
    return runOp(async () => {
      const query = new Query(this, filter, true);
      query.includeHidden = true;
      const existing = query.execSync();
      if (!existing) return null;
      const patch = update?.$set ?? update ?? {};
      for (const [key, value] of Object.entries(patch)) {
        if (!key.startsWith('$')) existing[key] = value;
      }
      await this.writeDoc(existing);
      return existing;
    });
  }

  async saveDoc(doc: Doc) {
    return runOp(async () => {
      await this.writeDoc(doc);
      return doc;
    });
  }

  readAll(): Record<string, any>[] {
    const statement = getDatabase().prepare('SELECT body FROM documents WHERE collection = ?');
    const rows: Record<string, any>[] = [];
    statement.bind([this.name]);
    while (statement.step()) {
      const record = statement.getAsObject() as { body?: string };
      if (record.body) rows.push(JSON.parse(record.body));
    }
    statement.free();
    return rows;
  }

  private async insertSync(payload: Record<string, any>) {
    const data: Record<string, any> = { ...payload };
    data._id = data._id || crypto.randomBytes(12).toString('hex');
    const now = new Date().toISOString();
    data.createdAt = data.createdAt || now;
    data.updatedAt = now;
    if (this.softDelete && data.isDeleted === undefined) data.isDeleted = false;
    if (this.beforeSave) await this.beforeSave(data, null);
    this.writeRow(data._id, data);
    return new Doc(this.name, data, this.methods);
  }

  private async writeDoc(doc: Doc) {
    const data = plainFrom(doc);
    const previous = this.readAll().find((row) => row._id === data._id) ?? null;
    if (previous) {
      for (const field of this.hidden) {
        if (data[field] === undefined && previous[field] !== undefined) {
          data[field] = previous[field];
        }
      }
      if (previous.createdAt) data.createdAt = previous.createdAt;
    }
    data.updatedAt = new Date().toISOString();
    if (this.beforeSave) await this.beforeSave(data, previous);
    Object.assign(doc, data);
    this.writeRow(data._id, data);
  }

  private writeRow(id: string, data: Record<string, any>) {
    const bodyStr = JSON.stringify(data);
    getDatabase().run(
      'INSERT OR REPLACE INTO documents (collection, id, body) VALUES (?, ?, ?)',
      [this.name, id, bodyStr],
    );
    markDirty();
    if (isMySQLActive()) {
      void saveRowToMySQL(this.name, id, bodyStr);
    }
  }
}

const registry = new Map<string, Collection>();

export function createCollection(name: string, options?: CollectionOptions) {
  return new Collection(name, options);
}
