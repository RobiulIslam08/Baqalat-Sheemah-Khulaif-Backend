import mongoose from 'mongoose';
import config from '../config';
import seedAdmin from './seedAdmin';
import seedDemo from './seedDemo';
import { ensureLicense } from '../modules/License/license.service';

let connecting: Promise<void> | null = null;

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  if (!connecting) {
    connecting = (async () => {
      if (!config.database_url) {
        throw new Error('DATABASE_URL is not set');
      }
      await mongoose.connect(config.database_url);
      await seedAdmin();
      await seedDemo();
      await ensureLicense();
      const name = mongoose.connection.name || 'sheemah_pos';
      console.log(`Database connected: MongoDB (${name})`);
    })().catch((err) => {
      connecting = null;
      throw err;
    });
  }
  await connecting;
}
