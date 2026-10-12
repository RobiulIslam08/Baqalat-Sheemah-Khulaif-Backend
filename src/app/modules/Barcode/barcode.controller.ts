import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { BarcodeService } from './barcode.service';

const generateLabels = catchAsync(async (req, res) => {
  const result = await BarcodeService.generateLabels(req.body, req.user.userId);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: 'Barcode labels generated', data: result });
});

const getJobs = catchAsync(async (req, res) => {
  const result = await BarcodeService.getJobs(req.query);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Barcode jobs retrieved', meta: result.meta, data: result.data });
});

export const BarcodeController = { generateLabels, getJobs };
