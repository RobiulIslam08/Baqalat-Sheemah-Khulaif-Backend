import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { CashAdjustmentService } from './cashAdjustment.service';

const postAdjustment = catchAsync(async (req, res) => {
  const result = await CashAdjustmentService.postAdjustment(req.body, req.user.userId);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Cash adjustment posted', data: result });
});

const getAdjustments = catchAsync(async (req, res) => {
  const result = await CashAdjustmentService.getAdjustments(req.query);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Cash adjustments retrieved', meta: result.meta, data: result.data });
});

export const CashAdjustmentController = { postAdjustment, getAdjustments };
