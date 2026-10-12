import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { CustomerService } from './customer.service';

const createCustomer = catchAsync(async (req, res) => {
  const result = await CustomerService.createCustomer(req.body);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Customer created successfully', data: result });
});

const getAllCustomers = catchAsync(async (req, res) => {
  const result = await CustomerService.getAllCustomers(req.query);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Customers retrieved successfully', meta: result.meta, data: result.data });
});

const getCustomerById = catchAsync(async (req, res) => {
  const result = await CustomerService.getCustomerById(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Customer retrieved successfully', data: result });
});

const updateCustomer = catchAsync(async (req, res) => {
  const result = await CustomerService.updateCustomer(req.params.id, req.body);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Customer updated successfully', data: result });
});

const deleteCustomer = catchAsync(async (req, res) => {
  await CustomerService.deleteCustomer(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Customer deleted successfully', data: null });
});

export const CustomerController = { createCustomer, getAllCustomers, getCustomerById, updateCustomer, deleteCustomer };
