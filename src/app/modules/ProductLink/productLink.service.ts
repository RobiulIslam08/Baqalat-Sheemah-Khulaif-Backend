import httpStatus from 'http-status';
import { ProductLink } from './productLink.model';
import { IProductLink } from './productLink.interface';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../utils/QueryBuilder';
import { resolveActiveProduct } from '../../utils/productStock';

const linkProducts = async (payload: IProductLink) => {
  if (!payload.conversionQty || payload.conversionQty < 1) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Conversion quantity must be at least 1');
  }
  const box = await resolveActiveProduct(payload.boxProductCode);
  const single = await resolveActiveProduct(payload.singleProductCode);
  if (!box || !single) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Both products must exist');
  }
  if (box.productCode === single.productCode) {
    throw new AppError(httpStatus.BAD_REQUEST, 'A product cannot be linked to itself');
  }
  payload.boxProductCode = box.productCode;
  payload.boxProductName = payload.boxProductName || box.productName;
  payload.singleProductCode = single.productCode;
  payload.singleProductName = payload.singleProductName || single.productName;
  return await ProductLink.create(payload);
};

const getLinks = async (query: Record<string, unknown>) => {
  const linkQuery = new QueryBuilder(ProductLink.find(), query)
    .search(['boxProductName', 'singleProductName', 'boxProductCode', 'singleProductCode']).filter().sort().paginate();
  const result = await linkQuery.modelQuery;
  const meta = await linkQuery.countTotal();
  return { meta, data: result };
};

export const ProductLinkService = { linkProducts, getLinks };
