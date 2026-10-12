import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { ProductSupplierService } from './productSupplier.service';

const linkSupplier = catchAsync(async (req, res) => {
  const result = await ProductSupplierService.linkSupplier(req.body);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Product-Supplier linked successfully', data: result });
});

const getLinks = catchAsync(async (req, res) => {
  const result = await ProductSupplierService.getLinks(req.query);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Product-Supplier links retrieved', meta: result.meta, data: result.data });
});

export const ProductSupplierController = { linkSupplier, getLinks };
