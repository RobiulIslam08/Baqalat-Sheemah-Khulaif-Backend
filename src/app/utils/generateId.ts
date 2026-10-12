type IdModel = {
  findOne: (filter?: Record<string, unknown>, projection?: unknown) => any;
};

/**
 * Generate a sequential ID with a prefix.
 * Example: generateId(ProductModel, 'productId', 'P') => "P-101"
 */
export const generateSequentialId = async (
  model: IdModel,
  field: string,
  prefix: string,
  startFrom: number = 100,
): Promise<string> => {
  const lastDoc = await model
    .findOne({}, { [field]: 1 })
    .sort({ [field]: -1 })
    .lean() as Record<string, any> | null;

  let nextNumber = startFrom;

  if (lastDoc && lastDoc[field]) {
    const lastId = lastDoc[field] as string;
    const parts = lastId.split('-');
    const lastNumber = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}-${nextNumber}`;
};

/**
 * Generate a voucher-style ID with year.
 * Example: generateVoucherId(ExpenseModel, 'voucherNo', 'EXP') => "EXP-2026-001"
 */
export const generateVoucherId = async (
  model: IdModel,
  field: string,
  prefix: string,
): Promise<string> => {
  const year = new Date().getFullYear();
  const yearPrefix = `${prefix}-${year}`;

  const lastDoc = await model
    .findOne({ [field]: { $regex: `^${yearPrefix}` } }, { [field]: 1 })
    .sort({ [field]: -1 })
    .lean() as Record<string, any> | null;

  let nextNumber = 1;

  if (lastDoc && lastDoc[field]) {
    const lastId = lastDoc[field] as string;
    const parts = lastId.split('-');
    const lastNumber = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${yearPrefix}-${String(nextNumber).padStart(3, '0')}`;
};

/**
 * Generate auto-incrementing number (for billNo, invoiceNo, etc.)
 */
export const generateAutoNumber = async (
  model: IdModel,
  field: string,
  startFrom: number = 1000,
): Promise<number> => {
  const lastDoc = await model
    .findOne({}, { [field]: 1 })
    .sort({ [field]: -1 })
    .lean() as Record<string, any> | null;

  if (lastDoc && lastDoc[field]) {
    return (lastDoc[field] as number) + 1;
  }

  return startFrom;
};
