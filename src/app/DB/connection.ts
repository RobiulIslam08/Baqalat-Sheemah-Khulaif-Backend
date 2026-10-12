import path from 'path';
import { openDatabase, autoBackup } from './sqlite';
import { isMySQLActive } from './mysql';
import seedAdmin from './seedAdmin';
import { ensureLicense } from '../modules/License/license.service';
import config from '../config';

let opened = false;

export async function connectDB(): Promise<void> {
  if (opened) return;
  const dataDir = process.env.POS_DATA_DIR || path.join(process.cwd(), 'data');
  const dbFile = path.join(dataDir, 'pos.db');
  await openDatabase(dbFile);
  await seedAdmin();
  await ensureLicense();
  autoBackup();
  opened = true;
  if (isMySQLActive()) {
    console.log(`🗄️ Database Connected: MySQL ("${config.db_name}" on ${config.db_host})`);
  } else {
    console.log(`🗄️ Database Connected: SQLite local storage (${dbFile})`);
  }
}
