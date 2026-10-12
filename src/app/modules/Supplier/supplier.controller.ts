import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { SupplierService } from './supplier.service';

const createSupplier = catchAsync(async (req, res) => {
  const result = await SupplierService.createSupplier(req.body);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Supplier created successfully', data: result });
});

const getAllSuppliers = catchAsync(async (req, res) => {
  const result = await SupplierService.getAllSuppliers(req.query);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Suppliers retrieved successfully', meta: result.meta, data: result.data });
});

const getSupplierById = catchAsync(async (req, res) => {
  const result = await SupplierService.getSupplierById(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Supplier retrieved successfully', data: result });
});

const updateSupplier = catchAsync(async (req, res) => {
  const result = await SupplierService.updateSupplier(req.params.id, req.body);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Supplier updated successfully', data: result });
});

const deleteSupplier = catchAsync(async (req, res) => {
  await SupplierService.deleteSupplier(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Supplier deleted successfully', data: null });
});

export const SupplierController = { createSupplier, getAllSuppliers, getSupplierById, updateSupplier, deleteSupplier };
