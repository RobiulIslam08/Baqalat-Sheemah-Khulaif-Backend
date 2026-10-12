import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { SaleService } from './sale.service';

const createSale = catchAsync(async (req, res) => {
  const result = await SaleService.createSale(req.body, req.user.userId);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Sale created successfully',
    data: result,
  });
});

const getAllSales = catchAsync(async (req, res) => {
  const result = await SaleService.getAllSales(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Sales retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getSaleByBillNo = catchAsync(async (req, res) => {
  const billNo = Number(req.params.billNo);
  const result = await SaleService.getSaleByBillNo(billNo);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Sale retrieved successfully',
    data: result,
  });
});

const createSalesReturn = catchAsync(async (req, res) => {
  const result = await SaleService.createSalesReturn(req.body, req.user.userId);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Sales return processed successfully',
    data: result,
  });
});

export const SaleController = { createSale, getAllSales, getSaleByBillNo, createSalesReturn };
