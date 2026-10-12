import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { allCollections } from '../../DB/collection';
import { User } from '../User/user.model';
import { Settings } from './settings.model';
import { ISettings } from './settings.interface';

const DEMO_COLLECTIONS = new Set([
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
]);

const KEEP_ON_DELETE_ALL = new Set(['settings', 'licenses']);

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

  for (const collection of allCollections()) {
    if (DEMO_COLLECTIONS.has(collection.name)) {
      await collection.deleteMany({});
    }
  }
  await User.deleteMany({ _id: { $ne: current._id } });
  return { keptUserId: userId };
};

const deleteAllData = async (userId: string) => {
  const current = await User.findOne({ userId });
  if (!current?._id) {
    throw new AppError(httpStatus.NOT_FOUND, 'Current user was not found');
  }

  for (const collection of allCollections()) {
    if (collection.name === 'users') {
      await collection.deleteMany({ _id: { $ne: current._id } });
    } else if (!KEEP_ON_DELETE_ALL.has(collection.name)) {
      await collection.deleteMany({});
    }
  }
  return { keptUserId: userId };
};

export const SettingsService = { getSettings, updateSettings, resetDemoData, deleteAllData };
