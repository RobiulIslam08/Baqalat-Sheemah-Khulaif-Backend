import mysql from 'mysql2/promise';
import config from '../config';

let pool: mysql.Pool | null = null;
let enabled = false;

export async function initMySQL(): Promise<mysql.Pool | null> {
  if (config.db_type !== 'mysql') {
    return null;
  }

  try {
    pool = mysql.createPool({
      host: config.db_host,
      port: config.db_port,
      user: config.db_user,
      password: config.db_pass,
      database: config.db_name,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });

    // Test connection
    const connection = await pool.getConnection();
    connection.release();

    // Ensure documents table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        collection VARCHAR(100) NOT NULL,
        id VARCHAR(100) NOT NULL,
        body LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (collection, id),
        INDEX idx_collection (collection)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    enabled = true;
    console.log(`✅ MySQL connected successfully to database "${config.db_name}" on ${config.db_host}:${config.db_port}`);
    return pool;
  } catch (err: any) {
    console.error(`❌ Failed to connect to MySQL database "${config.db_name}":`, err?.message || err);
    throw err;
  }
}

export function isMySQLActive(): boolean {
  return enabled && pool !== null;
}

export function getMySQLPool(): mysql.Pool | null {
  return pool;
}

export async function loadAllFromMySQL(): Promise<Array<{ collection: string; id: string; body: string }>> {
  if (!pool) return [];
  const [rows] = await pool.query('SELECT collection, id, body FROM documents');
  return rows as Array<{ collection: string; id: string; body: string }>;
}

export async function saveRowToMySQL(collection: string, id: string, bodyString: string): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(
      'INSERT INTO documents (collection, id, body) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE body = VALUES(body)',
      [collection, id, bodyString],
    );
  } catch (err) {
    console.error(`Error saving row [${collection}:${id}] to MySQL:`, err);
  }
}

export async function deleteCollectionFromMySQL(collection: string, exceptId?: string): Promise<void> {
  if (!pool) return;
  try {
    if (exceptId) {
      await pool.query('DELETE FROM documents WHERE collection = ? AND id != ?', [collection, exceptId]);
    } else {
      await pool.query('DELETE FROM documents WHERE collection = ?', [collection]);
    }
  } catch (err) {
    console.error(`Error deleting collection [${collection}] from MySQL:`, err);
  }
}

export async function deleteRowFromMySQL(collection: string, id: string): Promise<void> {
  if (!pool) return;
  try {
    await pool.query('DELETE FROM documents WHERE collection = ? AND id = ?', [collection, id]);
  } catch (err) {
    console.error(`Error deleting row [${collection}:${id}] from MySQL:`, err);
  }
}
