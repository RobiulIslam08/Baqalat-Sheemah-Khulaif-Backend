import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { PurchaseService } from './purchase.service';

const createPurchase = catchAsync(async (req, res) => {
  const result = await PurchaseService.createPurchase(req.body, req.user.userId);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Purchase created successfully', data: result });
});

const getAllPurchases = catchAsync(async (req, res) => {
  const result = await PurchaseService.getAllPurchases(req.query);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Purchases retrieved successfully', meta: result.meta, data: result.data });
});

const getPurchaseById = catchAsync(async (req, res) => {
  const result = await PurchaseService.getPurchaseById(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Purchase retrieved successfully', data: result });
});

export const PurchaseController = { createPurchase, getAllPurchases, getPurchaseById };
