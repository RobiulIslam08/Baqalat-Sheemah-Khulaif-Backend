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
  const products = await Product.find({}, 'productId').lean();

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
  // Product ID stays the auto serial. Code and quantity can be corrected here.
  delete payload.productId;
  delete payload.isDeleted;

  if (payload.productCode) {
    const duplicate = await Product.findOne({
      productCode: payload.productCode,
      _id: { $ne: id },
    });
    if (duplicate) {
      throw new AppError(httpStatus.CONFLICT, 'Product with this code or ID already exists');
    }
  }

  const product = await Product.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  return product;
};

/** Permanently remove soft-deleted product rows left by older versions. */
const purgeSoftDeletedProducts = async () => {
  await Product.deleteMany({ isDeleted: true });
};

// Hard delete product from the database
const deleteProduct = async (id: string) => {
  const product = await Product.findById(id);
  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  await Product.deleteMany({ _id: id });
  return product;
};

export const ProductService = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getNextProductId,
  purgeSoftDeletedProducts,
};
