import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { getDatabase, markDirty, runOp } from '../../DB/sqlite';
import { isMySQLActive, deleteCollectionFromMySQL } from '../../DB/mysql';
import { User } from '../User/user.model';
import { Settings } from './settings.model';
import { ISettings } from './settings.interface';

const DEMO_COLLECTIONS = [
  'sales',
  'purchases',
  'customers',
  'suppliers',
  'supplierCredits',
  'customerCredits',
  'expenses',
  'cashAdjustments',
  'tickets',
  'stockReturns',
  'stockCorrections',
  'barcodeJobs',
  'productSuppliers',
];

// Get settings (upsert singleton)
const getSettings = async () => {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({
      storeName: 'بقالة شيمه خليف عايد العنزي للمواد الغذائية',
      invoiceLanguage: 'both',
    });
  }
  if (!settings.invoiceLanguage) settings.invoiceLanguage = 'both';
  if (!settings.storeName) settings.storeName = 'بقالة شيمه خليف عايد العنزي للمواد الغذائية';
  return settings;
};

// Update settings
const updateSettings = async (payload: Partial<ISettings>) => {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create(payload);
  } else {
    Object.assign(settings, payload);
    await settings.save();
  }
  return settings;
};

const resetDemoData = async (userId: string) => {
  const current = await User.findOne({ userId });
  if (!current?._id) {
    throw new AppError(httpStatus.NOT_FOUND, 'Current user was not found');
  }

  return runOp(async () => {
    const db = getDatabase();
    for (const name of DEMO_COLLECTIONS) {
      db.run('DELETE FROM documents WHERE collection = ?', [name]);
      if (isMySQLActive()) {
        await deleteCollectionFromMySQL(name);
      }
    }
    db.run('DELETE FROM documents WHERE collection = ? AND id != ?', ['users', current._id]);
    if (isMySQLActive()) {
      await deleteCollectionFromMySQL('users', current._id);
    }
    markDirty();
    return { keptUserId: userId };
  });
};

export const SettingsService = { getSettings, updateSettings, resetDemoData };
