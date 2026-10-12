import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { CreditService } from './credit.service';

const recordSupplierPayment = catchAsync(async (req, res) => {
  const result = await CreditService.recordSupplierPayment(req.body, req.user.userId, req.user.role);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Supplier payment recorded', data: result });
});

const settleSupplierInvoice = catchAsync(async (req, res) => {
  const result = await CreditService.settleSupplierInvoice(req.params.id);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Supplier invoice settled', data: result });
});

const getSupplierCredits = catchAsync(async (req, res) => {
  const result = await CreditService.getSupplierCredits(req.query);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Supplier credits retrieved', meta: result.meta, data: result.data });
});

const receiveCustomerPayment = catchAsync(async (req, res) => {
  const result = await CreditService.receiveCustomerPayment(req.body, req.user.userId);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Customer payment received', data: result });
});

const getCustomerCredits = catchAsync(async (req, res) => {
  const result = await CreditService.getCustomerCredits(req.query);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Customer credits retrieved', meta: result.meta, data: result.data });
});

export const CreditController = {
  recordSupplierPayment, settleSupplierInvoice, getSupplierCredits,
  receiveCustomerPayment, getCustomerCredits,
};
