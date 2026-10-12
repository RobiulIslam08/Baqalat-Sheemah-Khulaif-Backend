import httpStatus from 'http-status';
import { startSession } from '../../DB/session';
import { Product } from '../Product/product.model';
import { StockReturn, StockCorrection } from './stock.model';
import { IStockReturn, IStockCorrection } from './stock.interface';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../utils/QueryBuilder';
import { endOfDay, startOfDay } from '../../utils/dates';
import { resolveActiveProduct } from '../../utils/productStock';



// Get all stock (products with stock info)
const getStock = async (query: Record<string, unknown>) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 50;
  const skip = (page - 1) * limit;

  // Build filter object
  const filter: Record<string, unknown> = { isDeleted: { $ne: true } };

  // Keyword search
  if (query.searchTerm) {
    const regex = new RegExp(query.searchTerm as string, 'i');
    filter.$or = [
      { productName: regex },
      { productCode: regex },
      { storage: regex },
    ] as any;
  }

  // Map warehouse -> storage filter
  if (query.warehouse) {
    const warehouse = String(query.warehouse).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.storage = { $regex: warehouse, $options: 'i' };
  }

  if (query.fromDate || query.toDate) {
    const dateFilter: Record<string, unknown> = {};
    if (query.fromDate) dateFilter['$gte'] = startOfDay(String(query.fromDate));
    if (query.toDate) dateFilter['$lte'] = endOfDay(String(query.toDate));
    if (Object.keys(dateFilter).length > 0) filter.updatedAt = dateFilter;
  }

  const projection = 'productCode productName arabicName batchCode quantity storage minQty expiryDate updatedAt';

  const [result, total] = await Promise.all([
    Product.find(filter as any, projection).sort('-createdAt').skip(skip).limit(limit),
    Product.countDocuments(filter as any),
  ]);

  const meta = { page, limit, total, totalPage: Math.ceil(total / limit) };
  return { meta, data: result };
};

// Process stock return
const processReturn = async (payload: IStockReturn, userId: string) => {
  const session = await startSession();

  try {
    session.startTransaction();

    payload.createdBy = userId;

    const product = await resolveActiveProduct(payload.productCode);
    if (!product) {
      throw new AppError(httpStatus.BAD_REQUEST, `Product not found for ${payload.productCode}`);
    }
    if (product.quantity < payload.returnQty) {
      throw new AppError(httpStatus.BAD_REQUEST, `Cannot remove ${payload.returnQty}. Available: ${product.quantity}`);
    }
    product.quantity -= payload.returnQty;
    payload.productCode = product.productCode;
    await product.save({ session });

    const [result] = await StockReturn.create([payload], { session });

    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Process stock correction
const processCorrection = async (payload: IStockCorrection, userId: string) => {
  const session = await startSession();

  try {
    session.startTransaction();

    payload.createdBy = userId;

    const corrections = new Map<string, (typeof payload.items)[number]>();
    for (const item of payload.items) {
      if (item.quantity < 0) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Corrected quantity cannot be negative');
      }
      const product = await resolveActiveProduct(item.code);
      if (!product) {
        throw new AppError(httpStatus.BAD_REQUEST, `Product not found for ${item.code || item.productName}`);
      }
      item.code = product.productCode;
      corrections.set(product.productCode, item);
    }
    for (const item of corrections.values()) {
      const product = await resolveActiveProduct(item.code);
      if (!product) {
        throw new AppError(httpStatus.BAD_REQUEST, `Product not found for ${item.code}`);
      }
      product.quantity = item.quantity;
      if (item.batchCode) product.batchCode = item.batchCode;
      if (item.expiryDate) product.expiryDate = new Date(item.expiryDate as unknown as string);
      await product.save({ session });
    }

    const [result] = await StockCorrection.create([payload], { session });

    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Get stock returns
const getStockReturns = async (query: Record<string, unknown>) => {
  const returnQuery = new QueryBuilder(StockReturn.find(), query)
    .search(['productName', 'productCode']).filter().sort().paginate();
  const result = await returnQuery.modelQuery;
  const meta = await returnQuery.countTotal();
  return { meta, data: result };
};

export const StockService = { getStock, processReturn, processCorrection, getStockReturns };
