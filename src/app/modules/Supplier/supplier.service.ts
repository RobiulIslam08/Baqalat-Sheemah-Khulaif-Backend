import httpStatus from 'http-status';
import { Supplier } from './supplier.model';
import { ISupplier } from './supplier.interface';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../utils/QueryBuilder';

const searchableFields = ['supplierName', 'supplierCode', 'contactPerson', 'phone'];

const createSupplier = async (payload: ISupplier) => {
  const existing = await Supplier.findOne({ supplierCode: payload.supplierCode });
  if (existing) {
    throw new AppError(httpStatus.CONFLICT, 'Supplier with this code already exists');
  }
  return await Supplier.create(payload);
};

const getAllSuppliers = async (query: Record<string, unknown>) => {
  const supplierQuery = new QueryBuilder(Supplier.find(), query)
    .search(searchableFields).filter().sort().paginate().fields();
  const result = await supplierQuery.modelQuery;
  const meta = await supplierQuery.countTotal();
  return { meta, data: result };
};

const getSupplierById = async (id: string) => {
  const supplier = await Supplier.findById(id);
  if (!supplier) throw new AppError(httpStatus.NOT_FOUND, 'Supplier not found');
  return supplier;
};

const updateSupplier = async (id: string, payload: Partial<ISupplier>) => {
  delete payload.supplierCode;
  delete payload.isDeleted;
  const supplier = await Supplier.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!supplier) throw new AppError(httpStatus.NOT_FOUND, 'Supplier not found');
  return supplier;
};

const deleteSupplier = async (id: string) => {
  const supplier = await Supplier.findById(id);
  if (!supplier) throw new AppError(httpStatus.NOT_FOUND, 'Supplier not found');
  supplier.isDeleted = true;
  await supplier.save();
};

export const SupplierService = {
  createSupplier, getAllSuppliers, getSupplierById, updateSupplier, deleteSupplier,
};
