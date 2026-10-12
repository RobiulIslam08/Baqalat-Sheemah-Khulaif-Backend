import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { StockService } from './stock.service';

const getStock = catchAsync(async (req, res) => {
  const result = await StockService.getStock(req.query);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Stock retrieved successfully', meta: result.meta, data: result.data });
});

const processReturn = catchAsync(async (req, res) => {
  const result = await StockService.processReturn(req.body, req.user.userId);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Stock return processed successfully', data: result });
});

const processCorrection = catchAsync(async (req, res) => {
  const result = await StockService.processCorrection(req.body, req.user.userId);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Stock correction saved successfully', data: result });
});

const getStockReturns = catchAsync(async (req, res) => {
  const result = await StockService.getStockReturns(req.query);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Stock returns retrieved successfully', meta: result.meta, data: result.data });
});

export const StockController = { getStock, processReturn, processCorrection, getStockReturns };
