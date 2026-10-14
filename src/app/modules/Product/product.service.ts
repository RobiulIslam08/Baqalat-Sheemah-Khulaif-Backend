import httpStatus from 'http-status';
import { Product } from './product.model';
import { IProduct } from './product.interface';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../utils/QueryBuilder';

const productSearchableFields = [
  'productName',
  'arabicName',
  'productCode',
  'productId',
  'storage',
];

// Create product
const createProduct = async (payload: IProduct) => {
  const existing = await Product.findOne({
    $or: [
      { productCode: payload.productCode },
      { productId: payload.productId },
    ],
    isDeleted: { $in: [true, false] },
  });

  if (existing) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Product with this code or ID already exists',
    );
  }

  const result = await Product.create(payload);
  return result;
};

// Compute the next serial product ID (plain number as string, e.g. "1", "2", "3"...)
const getNextProductId = async () => {
  const products = await Product.find(
    { isDeleted: { $in: [true, false] } },
    'productId',
  ).lean();

  let max = 0;
  for (const doc of products as any[]) {
    const n = parseInt(String(doc.productId).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }

  return String(max + 1);
};

// Get all products with search/filter/pagination
const getAllProducts = async (query: Record<string, unknown>) => {
  const productQuery = new QueryBuilder(Product.find(), query)
    .search(productSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await productQuery.modelQuery;
  const meta = await productQuery.countTotal();
  return { meta, data: result };
};

// Get single product
const getProductById = async (id: string) => {
  const product = await Product.findById(id);
  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }
  return product;
};

// Update product
const updateProduct = async (id: string, payload: Partial<IProduct>) => {
  // Prevent updating immutable fields
  delete payload.productId;
  delete payload.productCode;
  delete payload.isDeleted;
  delete payload.quantity;

  const product = await Product.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  return product;
};

// Soft delete product
const deleteProduct = async (id: string) => {
  const product = await Product.findById(id);
  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  if (Number(product.quantity) > 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Product still has stock and cannot be deleted');
  }
  product.isDeleted = true;
  await product.save();
  return product;
};

export const ProductService = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getNextProductId,
};
