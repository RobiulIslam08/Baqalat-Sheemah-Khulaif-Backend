import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { initMySQL, isMySQLActive, loadAllFromMySQL, saveRowToMySQL } from './mysql';

const nodeRequire = createRequire(__filename);

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let dbFile = '';
let dirty = false;
let txActive = false;

let locked = false;
const waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  if (!locked) {
    locked = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiters.push(resolve));
}

function release() {
  const next = waiters.shift();
  if (next) next();
  else locked = false;
}

function wasmFile(): string {
  const pkgDir = path.dirname(nodeRequire.resolve('sql.js'));
  const nextToPkg = path.join(pkgDir, 'sql-wasm.wasm');
  if (fs.existsSync(nextToPkg)) return nextToPkg;
  return path.join(pkgDir, 'dist', 'sql-wasm.wasm');
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database is not open');
  return db;
}

export function getDatabaseFile(): string {
  return dbFile;
}

export function isTransactionActive(): boolean {
  return txActive;
}

export async function openDatabase(filePath: string): Promise<void> {
  if (!SQL) {
    SQL = await initSqlJs({ locateFile: () => wasmFile() });
  }
  dbFile = filePath;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  db = new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      body TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    );
  `);

  let mysqlLoaded = false;
  try {
    const pool = await initMySQL();
    if (pool && isMySQLActive()) {
      const mysqlRows = await loadAllFromMySQL();
      if (mysqlRows.length > 0) {
        for (const row of mysqlRows) {
          db.run('INSERT OR REPLACE INTO documents (collection, id, body) VALUES (?, ?, ?)', [
            row.collection,
            row.id,
            row.body,
          ]);
        }
        mysqlLoaded = true;
        console.log(`✅ Loaded ${mysqlRows.length} documents from MySQL database`);
      }
    }
  } catch (err: any) {
    console.warn('MySQL init encountered an issue, checking fallback SQLite:', err?.message || err);
  }

  // If MySQL was empty or not active, check if local pos.db has records to seed/migrate
  if (!mysqlLoaded && fs.existsSync(filePath)) {
    try {
      const file = fs.readFileSync(filePath);
      const localDb = new SQL.Database(file);
      const stmt = localDb.prepare('SELECT collection, id, body FROM documents');
      let count = 0;
      while (stmt.step()) {
        const [c, id, b] = stmt.get();
        if (typeof c === 'string' && typeof id === 'string' && typeof b === 'string') {
          db.run('INSERT OR REPLACE INTO documents (collection, id, body) VALUES (?, ?, ?)', [c, id, b]);
          if (isMySQLActive()) {
            await saveRowToMySQL(c, id, b);
          }
          count++;
        }
      }
      stmt.free();
      localDb.close();
      if (isMySQLActive() && count > 0) {
        console.log(`✅ Successfully seeded ${count} initial records from local DB into MySQL database!`);
      }
    } catch (e) {
      console.error('Error reading local db file:', e);
    }
  }

  persist();
}

function persist() {
  if (!db || !dbFile) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const tmp = `${dbFile}.tmp`;
  fs.writeFileSync(tmp, buffer);
  fs.copyFileSync(tmp, dbFile);
  fs.rmSync(tmp, { force: true });
  dirty = false;
}

export function markDirty() {
  dirty = true;
}

export async function runOp<T>(fn: () => Promise<T> | T): Promise<T> {
  if (txActive) return await fn();
  await acquire();
  try {
    const result = await fn();
    if (dirty) persist();
    return result;
  } finally {
    release();
  }
}

export async function startSession() {
  await acquire();
  txActive = true;
  getDatabase().run('BEGIN');
  let settled = false;

  const finish = (sql: 'COMMIT' | 'ROLLBACK') => {
    if (settled) return;
    settled = true;
    try {
      getDatabase().run(sql);
    } catch {
      // Transaction may already be closed.
    }
    txActive = false;
    if (sql === 'COMMIT' && dirty) persist();
    dirty = false;
    release();
  };

  return {
    async startTransaction() {
      return undefined;
    },
    async commitTransaction() {
      finish('COMMIT');
    },
    async abortTransaction() {
      finish('ROLLBACK');
    },
    endSession() {
      if (!settled) finish('ROLLBACK');
    },
  };
}

export async function exportDatabase(): Promise<Buffer> {
  return runOp(async () => {
    if (dirty) persist();
    return fs.readFileSync(dbFile);
  });
}

export async function replaceDatabase(buffer: Buffer): Promise<void> {
  if (!SQL) throw new Error('Database engine is not ready');
  await acquire();
  try {
    if (txActive) {
      try {
        getDatabase().run('ROLLBACK');
      } catch {
        // ignore
      }
      txActive = false;
    }
    const test = new SQL.Database(buffer);
    try {
      test.exec('SELECT name FROM sqlite_master WHERE type = "table" AND name = "documents"');
      const check = test.exec(
        'SELECT name FROM sqlite_master WHERE type = "table" AND name = "documents"',
      );
      if (!check.length) throw new Error('Invalid backup file');
    } finally {
      test.close();
    }
    if (db) db.close();
    db = new SQL.Database(buffer);
    persist();
  } finally {
    release();
  }
}

export function autoBackup() {
  if (!dbFile || !fs.existsSync(dbFile)) return;
  const dir = path.join(path.dirname(dbFile), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const dest = path.join(dir, `pos-${day}.db`);
  if (!fs.existsSync(dest)) {
    if (dirty) persist();
    fs.copyFileSync(dbFile, dest);
  }
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.db'))
    .sort();
  while (files.length > 7) {
    const oldest = files.shift();
    if (oldest) fs.rmSync(path.join(dir, oldest), { force: true });
  }
}
