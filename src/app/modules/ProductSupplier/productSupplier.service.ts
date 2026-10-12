import { ProductSupplier } from './productSupplier.model';
import { IProductSupplier } from './productSupplier.interface';
import QueryBuilder from '../../utils/QueryBuilder';

const linkSupplier = async (payload: IProductSupplier) => {
  return await ProductSupplier.create(payload);
};

const getLinks = async (query: Record<string, unknown>) => {
  const linkQuery = new QueryBuilder(ProductSupplier.find(), query)
    .search(['productName', 'productCode', 'supplierName']).filter().sort().paginate();
  const result = await linkQuery.modelQuery;
  const meta = await linkQuery.countTotal();
  return { meta, data: result };
};

export const ProductSupplierService = { linkSupplier, getLinks };
