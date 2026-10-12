import crypto from 'crypto';
import mongoose, { ClientSession, Model, Schema } from 'mongoose';
import { currentSession } from './session';

export interface CollectionOptions {
  softDelete?: boolean;
  hidden?: string[];
  refs?: Record<string, string>;
  methods?: Record<string, (this: Doc, ...args: any[]) => unknown>;
  beforeSave?: (data: Record<string, any>, previous: Record<string, any> | null) => Promise<void> | void;
}

const models = new Map<string, Model<any>>();

export function getMongoModel(name: string): Model<any> {
  const cached = models.get(name);
  if (cached) return cached;
  const existing = mongoose.models[name] as Model<any> | undefined;
  if (existing) {
    models.set(name, existing);
    return existing;
  }
  const schema = new Schema(
    { _id: { type: String } },
    { strict: false, versionKey: false, id: false, collection: name },
  );
  const model = mongoose.model(name, schema, name);
  models.set(name, model);
  return model;
}

function sessionOptions(): { session?: ClientSession } {
  const session = currentSession();
  return session ? { session } : {};
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof RegExp) return value;
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = normalizeValue(inner);
    }
    return out;
  }
  return value;
}

function mentions(filter: unknown, key: string): boolean {
  if (!filter || typeof filter !== 'object') return false;
  return JSON.stringify(filter).includes(`"${key}"`);
}

function parseSort(spec: unknown): Array<{ field: string; dir: 1 | -1 }> {
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

function mongoSort(spec: unknown): Record<string, 1 | -1> {
  const out: Record<string, 1 | -1> = {};
  for (const rule of parseSort(spec)) out[rule.field] = rule.dir;
  return out;
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

  async save(_options?: unknown) {
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
    const filter = this.collection.applySoftDelete(this.getFilter());
    let cursor = this.collection.mongo().find(filter).sort(mongoSort(this.sortSpec)).collation({
      locale: 'en',
      numericOrdering: true,
    });
    const session = currentSession();
    if (session) cursor = cursor.session(session);
    if (!this.single) {
      if (this.skipCount) cursor = cursor.skip(this.skipCount);
      if (this.limitCount != null) cursor = cursor.limit(this.limitCount);
    } else {
      cursor = cursor.limit(1);
    }

    const rows = await cursor.lean();
    let docs = rows.map((row) => this.hydrate(row as Record<string, any>));

    for (const field of this.populateFields) {
      const targetName = this.collection.refs[field];
      const target = targetName ? registry.get(targetName) : undefined;
      if (!target) continue;
      const ids = [
        ...new Set(
          docs
            .map((doc) => doc[field])
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      ];
      const relatedRows = ids.length
        ? await target
            .mongo()
            .find({ _id: { $in: ids }, isDeleted: { $ne: true } })
            .lean()
        : [];
      const byId = new Map(
        relatedRows.map((row) => [String((row as { _id?: string })._id), this.presentRelated(row as Record<string, any>, target)]),
      );
      docs = docs.map((doc) => {
        const id = doc[field];
        if (typeof id === 'string') doc[field] = byId.get(id) ?? null;
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

  mongo() {
    return getMongoModel(this.name);
  }

  applySoftDelete(filter: any) {
    const normalized = (normalizeValue(filter && typeof filter === 'object' ? filter : {}) ?? {}) as Record<string, unknown>;
    if (this.softDelete && !mentions(normalized, 'isDeleted')) {
      if (Object.keys(normalized).length === 0) return { isDeleted: { $ne: true } };
      return { $and: [normalized, { isDeleted: { $ne: true } }] };
    }
    return normalized;
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
    if (Array.isArray(payload)) {
      const created = [];
      for (const item of payload) created.push(await this.insert(item));
      return created;
    }
    return this.insert(payload);
  }

  async countDocuments(filter: any = {}) {
    const mongoFilter = this.applySoftDelete(filter);
    let query = this.mongo().countDocuments(mongoFilter);
    const session = currentSession();
    if (session) query = query.session(session);
    return query;
  }

  async deleteMany(filter: any = {}) {
    const normalized = (normalizeValue(filter && typeof filter === 'object' ? filter : {}) ?? {}) as Record<string, unknown>;
    await this.mongo().deleteMany(normalized, sessionOptions());
  }

  async findByIdAndUpdate(id: string, update: any, _options?: unknown) {
    return this.findOneAndUpdate({ _id: id }, update);
  }

  async findOneAndUpdate(filter: any, update: any, _options?: unknown) {
    const query = new Query(this, filter, true);
    query.includeHidden = true;
    const existing = await query.exec();
    if (!existing) return null;
    const patch = update?.$set ?? update ?? {};
    for (const [key, value] of Object.entries(patch)) {
      if (!key.startsWith('$')) existing[key] = value;
    }
    await this.writeDoc(existing);
    return existing;
  }

  async saveDoc(doc: Doc) {
    await this.writeDoc(doc);
    return doc;
  }

  private async insert(payload: Record<string, any>) {
    const data: Record<string, any> = { ...payload };
    data._id = data._id || crypto.randomBytes(12).toString('hex');
    const now = new Date().toISOString();
    data.createdAt = data.createdAt || now;
    data.updatedAt = now;
    if (this.softDelete && data.isDeleted === undefined) data.isDeleted = false;
    if (this.beforeSave) await this.beforeSave(data, null);
    await this.mongo().replaceOne({ _id: data._id }, data, { upsert: true, ...sessionOptions() });
    return new Doc(this.name, data, this.methods);
  }

  private async writeDoc(doc: Doc) {
    const data = plainFrom(doc);
    let previousQuery = this.mongo().findOne({ _id: data._id });
    const session = currentSession();
    if (session) previousQuery = previousQuery.session(session);
    const previous = (await previousQuery.lean()) as Record<string, any> | null;
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
    await this.mongo().replaceOne({ _id: data._id }, data, { upsert: true, ...sessionOptions() });
  }
}

const registry = new Map<string, Collection>();

export function createCollection(name: string, options?: CollectionOptions) {
  return new Collection(name, options);
}

export function allCollections(): Collection[] {
  return [...registry.values()];
}

export async function exportCollections(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const collection of registry.values()) {
    out[collection.name] = await collection.mongo().find({}).lean();
  }
  return out;
}

export async function replaceCollections(data: Record<string, unknown[]>): Promise<void> {
  const names = new Set([...registry.keys(), ...Object.keys(data)]);
  for (const name of names) {
    const rows = Array.isArray(data[name]) ? data[name] : [];
    const model = getMongoModel(name);
    await model.deleteMany({});
    if (rows.length) await model.insertMany(rows);
  }
}
