import httpStatus from 'http-status';
import { startSession } from '../../DB/sqlite';
import { Sale } from './sale.model';
import { ISale, ISaleItem } from './sale.interface';
import AppError from '../../errors/AppError';
import { generateAutoNumber } from '../../utils/generateId';
import QueryBuilder from '../../utils/QueryBuilder';
import { resolveActiveProduct, roundMoney, stockMove } from '../../utils/productStock';

const saleSearchableFields = ['billNo', 'paymentMode', 'createdBy'];

function inclusiveVat(total: number, vatPercent: number) {
  const rate = Number(vatPercent) || 0;
  return roundMoney((total / (100 + rate)) * rate);
}

async function cachedProduct(cache: Map<string, any>, code: string) {
  const product = await resolveActiveProduct(code);
  if (!product) return null;
  const key = product.productCode;
  if (!cache.has(key)) cache.set(key, product);
  return cache.get(key);
}

async function priceLine(item: ISaleItem, vatPercent: number, cache: Map<string, any>, forcedTotal?: number) {
  const product = await cachedProduct(cache, item.code);
  if (!product) {
    throw new AppError(httpStatus.BAD_REQUEST, `Product not found for ${item.code || item.productName}`);
  }
  const move = await stockMove(product, item.type, item.quantity);
  const holder = await cachedProduct(cache, move.holderCode);
  if (!holder) {
    throw new AppError(httpStatus.BAD_REQUEST, `Product not found for ${move.holderCode}`);
  }
  const total = forcedTotal == null ? roundMoney(move.units * (Number(product.sellingPrice) || 0)) : roundMoney(forcedTotal);
  const vat = inclusiveVat(total, vatPercent);
  const price = item.quantity > 0 ? roundMoney((total - vat) / item.quantity) : 0;
  return {
    item: {
      ...item,
      code: product.productCode,
      productName: item.productName || product.productName,
      price,
      vat,
      total,
    },
    holder,
    units: move.units,
  };
}

function applyMoney(payload: ISale, totalAmount: number, discount: number) {
  if (discount < 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Discount cannot be negative');
  }
  if (discount > totalAmount) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Discount cannot exceed the total');
  }
  const netAmount = roundMoney(totalAmount - discount);
  const amountPaid = roundMoney(Number(payload.amountPaid) || 0);
  if (amountPaid < 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Amount paid cannot be negative');
  }
  payload.totalAmount = totalAmount;
  payload.discount = discount;
  payload.netAmount = netAmount;
  payload.amountPaid = amountPaid;
  payload.balance = roundMoney(amountPaid - netAmount);
}

const createSale = async (payload: ISale, userId: string) => {
  const session = await startSession();

  try {
    session.startTransaction();

    const billNo = await generateAutoNumber(Sale, 'billNo', 8500);
    payload.billNo = billNo;
    payload.createdBy = userId;
    payload.isReturn = false;

    const cache = new Map<string, any>();
    const priced = [];
    for (const item of payload.items) {
      const line = await priceLine(item, payload.vatPercent, cache);
      if (line.holder.quantity < line.units) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Insufficient stock for ${line.item.productName}. Available: ${line.holder.quantity}`,
        );
      }
      line.holder.quantity -= line.units;
      await line.holder.save({ session });
      priced.push(line);
    }

    payload.items = priced.map((line) => line.item);
    const totalAmount = roundMoney(payload.items.reduce((sum, item) => sum + item.total, 0));
    applyMoney(payload, totalAmount, roundMoney(Number(payload.discount) || 0));

    const [result] = await Sale.create([payload], { session });
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getAllSales = async (query: Record<string, unknown>) => {
  if (query.type === 'RETURN') {
    query.isReturn = true;
  } else {
    query.isReturn = { $ne: true };
  }
  delete query.type;

  const saleQuery = new QueryBuilder(Sale.find().populate('customer'), query)
    .search(saleSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await saleQuery.modelQuery;
  const meta = await saleQuery.countTotal();
  const matched = await Sale.find(saleQuery.modelQuery.getFilter());
  const netTotal = roundMoney(matched.reduce((sum: number, row: { netAmount?: number }) => sum + (Number(row.netAmount) || 0), 0));

  return {
    meta: { ...meta, netTotal },
    data: result,
  };
};

const getSaleByBillNo = async (billNo: number) => {
  const sale = await Sale.findOne({ billNo }).populate('customer');
  if (!sale) {
    throw new AppError(httpStatus.NOT_FOUND, 'Sale not found');
  }
  return sale;
};

async function quantityAlreadyReturned(billNo: number) {
  const prior = await Sale.find({ isReturn: true, returnReference: billNo });
  const used = new Map<string, number>();
  for (const row of prior) {
    for (const item of row.items || []) {
      const product = await resolveActiveProduct(item.code);
      const key = product?.productCode || item.code;
      used.set(key, (used.get(key) || 0) + Number(item.quantity));
    }
  }
  return used;
}

const createSalesReturn = async (payload: ISale, userId: string) => {
  const session = await startSession();

  try {
    session.startTransaction();

    const billNo = await generateAutoNumber(Sale, 'billNo', 8500);
    payload.billNo = billNo;
    payload.createdBy = userId;
    payload.isReturn = true;

    let original: any = null;
    if (payload.returnReference) {
      original = await Sale.findOne({ billNo: payload.returnReference }).session(session);
      if (!original) {
        throw new AppError(httpStatus.NOT_FOUND, 'Original invoice was not found');
      }
      if (original.isReturn) {
        throw new AppError(httpStatus.BAD_REQUEST, 'A return cannot be returned');
      }
    }

    const cache = new Map<string, any>();
    const priced = [];
    for (const item of payload.items) {
      let forcedTotal: number | undefined;
      if (original) {
        let matched: ISaleItem | undefined;
        for (const source of original.items || []) {
          const sourceProduct = await cachedProduct(cache, source.code);
          const sourceKey = sourceProduct?.productCode || source.code;
          const itemProduct = await cachedProduct(cache, item.code);
          if (itemProduct && sourceKey === itemProduct.productCode) {
            matched = source;
            break;
          }
        }
        if (!matched) {
          throw new AppError(httpStatus.BAD_REQUEST, `${item.productName || item.code} is not on invoice ${payload.returnReference}`);
        }
        const soldQty = Number(matched.quantity) || 0;
        forcedTotal = soldQty > 0 ? (Number(matched.total) / soldQty) * Number(item.quantity) : 0;
      }
      priced.push(await priceLine(item, original?.vatPercent ?? payload.vatPercent, cache, forcedTotal));
    }

    if (original) {
      const sold = new Map<string, number>();
      for (const item of original.items || []) {
        const product = await resolveActiveProduct(item.code);
        const key = product?.productCode || item.code;
        sold.set(key, (sold.get(key) || 0) + Number(item.quantity));
      }
      const used = await quantityAlreadyReturned(original.billNo);
      const requested = new Map<string, number>();
      for (const line of priced) {
        requested.set(line.item.code, (requested.get(line.item.code) || 0) + line.item.quantity);
      }
      for (const [code, quantity] of requested) {
        const allowed = (sold.get(code) || 0) - (used.get(code) || 0);
        if (quantity > allowed) {
          throw new AppError(httpStatus.BAD_REQUEST, `Return quantity for ${code} exceeds the quantity still sold`);
        }
      }
    }

    for (const line of priced) {
      line.holder.quantity += line.units;
      await line.holder.save({ session });
    }

    payload.items = priced.map((line) => line.item);
    const totalAmount = roundMoney(payload.items.reduce((sum, item) => sum + item.total, 0));
    let discount = roundMoney(Number(payload.discount) || 0);
    if (original) {
      const originalTotal = Number(original.totalAmount) || 0;
      discount = originalTotal > 0 ? roundMoney((Number(original.discount) || 0) * (totalAmount / originalTotal)) : 0;
      discount = Math.min(discount, totalAmount);
    }
    applyMoney(payload, totalAmount, discount);

    if (original) {
      const owed = Math.max(0, roundMoney(-(Number(original.balance) || 0)));
      const debtReduction = Math.min(owed, payload.netAmount);
      const cashRefund = roundMoney(payload.netAmount - debtReduction);
      original.balance = roundMoney((Number(original.balance) || 0) + debtReduction);
      original.amountPaid = roundMoney(Math.max(0, (Number(original.amountPaid) || 0) - cashRefund));
      await original.save({ session });
    }

    const [result] = await Sale.create([payload], { session });
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const SaleService = { createSale, getAllSales, getSaleByBillNo, createSalesReturn };
