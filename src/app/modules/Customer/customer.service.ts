import httpStatus from 'http-status';
import { Customer } from './customer.model';
import { ICustomer } from './customer.interface';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../utils/QueryBuilder';

const searchableFields = ['customerName', 'customerCode', 'mobile', 'email'];

const createCustomer = async (payload: ICustomer) => {
  const existing = await Customer.findOne({ customerCode: payload.customerCode });
  if (existing) throw new AppError(httpStatus.CONFLICT, 'Customer with this code already exists');
  return await Customer.create(payload);
};

const getAllCustomers = async (query: Record<string, unknown>) => {
  const customerQuery = new QueryBuilder(Customer.find(), query)
    .search(searchableFields).filter().sort().paginate().fields();
  const result = await customerQuery.modelQuery;
  const meta = await customerQuery.countTotal();
  return { meta, data: result };
};

const getCustomerById = async (id: string) => {
  const customer = await Customer.findById(id);
  if (!customer) throw new AppError(httpStatus.NOT_FOUND, 'Customer not found');
  return customer;
};

const updateCustomer = async (id: string, payload: Partial<ICustomer>) => {
  delete payload.customerCode;
  delete payload.isDeleted;
  const customer = await Customer.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!customer) throw new AppError(httpStatus.NOT_FOUND, 'Customer not found');
  return customer;
};

const deleteCustomer = async (id: string) => {
  const customer = await Customer.findById(id);
  if (!customer) throw new AppError(httpStatus.NOT_FOUND, 'Customer not found');
  customer.isDeleted = true;
  await customer.save();
};

export const CustomerService = { createCustomer, getAllCustomers, getCustomerById, updateCustomer, deleteCustomer };
