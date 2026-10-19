import httpStatus from 'http-status';
import { BarcodeJob } from './barcode.model';
import { IBarcodeJob } from './barcode.interface';
import { Product } from '../Product/product.model';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../utils/QueryBuilder';
import { resolveActiveProduct } from '../../utils/productStock';

const generateLabels = async (payload: IBarcodeJob, userId: string) => {
  payload.generatedBy = userId;
  const product = await resolveActiveProduct(payload.productCode);
  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }
  const barcodeValue = payload.barcodeValue || product.productCode;
  const otherProduct = await Product.findOne({
    $or: [{ productCode: barcodeValue }, { barcodeValue }],
  });
  if (otherProduct && otherProduct.productCode !== product.productCode) {
    throw new AppError(httpStatus.CONFLICT, 'Barcode is already used by another product');
  }
  const otherJob = await BarcodeJob.findOne({ barcodeValue });
  if (otherJob && otherJob.productCode !== product.productCode) {
    throw new AppError(httpStatus.CONFLICT, 'Barcode is already used by another product');
  }
  payload.productCode = product.productCode;
  payload.barcodeValue = barcodeValue;
  product.barcodeValue = barcodeValue;
  await product.save();
  return await BarcodeJob.create(payload);
};

const getJobs = async (query: Record<string, unknown>) => {
  const jobQuery = new QueryBuilder(BarcodeJob.find(), query)
    .search(['productCode', 'barcodeValue']).filter().sort().paginate();
  const result = await jobQuery.modelQuery;
  const meta = await jobQuery.countTotal();
  return { meta, data: result };
};

export const BarcodeService = { generateLabels, getJobs };
