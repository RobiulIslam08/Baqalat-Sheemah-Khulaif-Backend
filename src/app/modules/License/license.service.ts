import crypto from 'crypto';
import httpStatus from 'http-status';
import config from '../../config';
import AppError from '../../errors/AppError';
import { createCollection } from '../../DB/collection';
import { User } from '../User/user.model';

const License = createCollection('licenses');
const LICENSE_ID = 'shop-license';

type LicenseFields = {
  validUntil: string;
  suspended: boolean;
  readOnly: boolean;
  supportPhone: string;
  note: string;
};

function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function addDays(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
}

function canonical(fields: LicenseFields) {
  return `${fields.validUntil}|${fields.suspended ? '1' : '0'}|${fields.readOnly ? '1' : '0'}|${fields.supportPhone}|${fields.note}`;
}

function canonicalLegacy(fields: LicenseFields) {
  return `${fields.validUntil}|${fields.suspended ? '1' : '0'}|${fields.supportPhone}|${fields.note}`;
}

const LEGACY_LICENSE_SECRET = 'euro-pos-license-v1';

function signWith(secret: string, fields: LicenseFields) {
  return crypto.createHmac('sha256', secret).update(canonical(fields)).digest('hex');
}

function sign(fields: LicenseFields) {
  return signWith(config.license_secret, fields);
}

async function signatureMatches(doc: any) {
  const fields = fieldsOf(doc);
  // Match standard format
  if (doc.signature === sign(fields)) return true;

  // Match legacy signature format (without readOnly)
  const legacySign = crypto.createHmac('sha256', config.license_secret).update(canonicalLegacy(fields)).digest('hex');
  if (doc.signature === legacySign) {
    doc.signature = sign(fields);
    await doc.save();
    return true;
  }

  // Match legacy secret
  if (config.license_secret !== LEGACY_LICENSE_SECRET) {
    const legacySign2 = crypto.createHmac('sha256', LEGACY_LICENSE_SECRET).update(canonicalLegacy(fields)).digest('hex');
    if (doc.signature === legacySign2) {
      doc.signature = sign(fields);
      await doc.save();
      return true;
    }
  }
  return false;
}

function fieldsOf(doc: any): LicenseFields {
  return {
    validUntil: String(doc.validUntil || ''),
    suspended: Boolean(doc.suspended),
    readOnly: Boolean(doc.readOnly),
    supportPhone: String(doc.supportPhone || ''),
    note: String(doc.note || ''),
  };
}

async function readRaw() {
  return License.findById(LICENSE_ID);
}

export async function ensureLicense() {
  const existing = await readRaw();
  if (existing) return existing;
  const fields: LicenseFields = {
    validUntil: addDays(todayString(), 30),
    suspended: false,
    readOnly: false,
    supportPhone: '',
    note: '',
  };
  return License.create({
    _id: LICENSE_ID,
    ...fields,
    signature: sign(fields),
  });
}

async function verified() {
  const doc = await ensureLicense();
  const fields = fieldsOf(doc);
  const signatureOk = await signatureMatches(doc);
  const expired = !signatureOk || fields.validUntil < todayString();
  return { doc, fields, signatureOk, expired };
}

function blockMessage(fields: LicenseFields, suspended: boolean) {
  if (suspended) {
    const custom = fields.note ? ` - ${fields.note}` : '';
    const phone = fields.supportPhone ? ` | هاتف الدعم الفني: ${fields.supportPhone}` : '';
    return `الموقع متوقف للصيانة حالياً بأمر المطور. Website is currently offline for maintenance by the developer.${custom}${phone}`;
  }
  const phone = fields.supportPhone ? ` Contact the developer: ${fields.supportPhone}` : ' Contact the developer.';
  return `انتهت صلاحية الترخيص. License expired.${phone}`;
}

export async function assertShopOpen(role?: string) {
  if (role === 'developer') return;
  const state = await verified();
  if (!state.signatureOk || state.fields.suspended || state.expired) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      blockMessage(
        state.signatureOk ? state.fields : { ...state.fields, supportPhone: '', note: '' },
        state.fields.suspended && state.signatureOk,
      ),
    );
  }
}

export async function assertCanModify(role?: string) {
  if (role === 'developer') return;
  const state = await verified();
  if (state.fields.readOnly) {
    const custom = state.fields.note ? ` - ${state.fields.note}` : '';
    const phone = state.fields.supportPhone ? ` | هاتف المطور: ${state.fields.supportPhone}` : '';
    throw new AppError(
      httpStatus.FORBIDDEN,
      `الموقع في وضع الصيانة حالياً. تم إيقاف جميع عمليات الإضافة والتعديل والحذف مؤقتاً. Adding, editing, and deleting are currently disabled during maintenance.${custom}${phone}`,
    );
  }
}

export async function getLicenseStatus() {
  const state = await verified();
  const open = state.signatureOk && !state.fields.suspended && !state.expired;
  const today = todayString();
  const daysLeft = state.signatureOk
    ? Math.round((Date.parse(state.fields.validUntil) - Date.parse(today)) / 86400000)
    : 0;
  return {
    validUntil: state.signatureOk ? state.fields.validUntil : null,
    suspended: state.signatureOk ? state.fields.suspended : false,
    readOnly: state.signatureOk ? state.fields.readOnly : false,
    supportPhone: state.signatureOk ? state.fields.supportPhone : '',
    note: state.signatureOk ? state.fields.note : '',
    open,
    daysLeft,
    tampered: !state.signatureOk,
  };
}

export async function updateLicense(
  payload: {
    validUntil?: string;
    addDays?: number;
    suspended?: boolean;
    readOnly?: boolean;
    supportPhone?: string;
    note?: string;
  },
  updatedBy: string,
) {
  const state = await verified();
  const base = state.signatureOk ? state.fields : {
    validUntil: todayString(),
    suspended: false,
    readOnly: false,
    supportPhone: '',
    note: '',
  };

  let validUntil = base.validUntil;
  if (payload.validUntil) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.validUntil)) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Date must be YYYY-MM-DD');
    }
    if (payload.validUntil < todayString()) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Expiry date cannot be in the past');
    }
    validUntil = payload.validUntil;
  } else if (payload.addDays) {
    const start = validUntil > todayString() ? validUntil : todayString();
    validUntil = addDays(start, Number(payload.addDays));
  }

  const next: LicenseFields = {
    validUntil,
    suspended: payload.suspended !== undefined ? Boolean(payload.suspended) : base.suspended,
    readOnly: payload.readOnly !== undefined ? Boolean(payload.readOnly) : base.readOnly,
    supportPhone: payload.supportPhone !== undefined ? String(payload.supportPhone) : base.supportPhone,
    note: payload.note !== undefined ? String(payload.note) : base.note,
  };

  const doc = state.doc;
  Object.assign(doc, next, { signature: sign(next), updatedBy });
  await doc.save();
  return getLicenseStatus();
}

export async function resetAdminPassword(password: string) {
  if (!password || password.length < 6) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password must be at least 6 characters');
  }
  const admin = await User.findOne({ username: 'admin' }).select('+password');
  if (!admin || admin.role === 'developer') {
    throw new AppError(httpStatus.NOT_FOUND, 'Shop admin user was not found');
  }
  admin.password = password;
  admin.passwordChangedAt = new Date();
  await admin.save();
}

export async function changeDeveloperPassword(userId: string, oldPassword: string, newPassword: string) {
  if (!newPassword || newPassword.length < 6) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password must be at least 6 characters');
  }
  const user = await User.findOne({ userId }).select('+password');
  if (!user || user.role !== 'developer') {
    throw new AppError(httpStatus.FORBIDDEN, 'Developer account was not found');
  }
  const matched = await user.comparePassword(oldPassword);
  if (!matched) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Old password is incorrect');
  }
  user.password = newPassword;
  user.passwordChangedAt = new Date();
  await user.save();
}
