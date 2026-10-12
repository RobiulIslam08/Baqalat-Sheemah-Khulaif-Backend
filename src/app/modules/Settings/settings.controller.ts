import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { SettingsService } from './settings.service';

const getSettings = catchAsync(async (req, res) => {
  const result = await SettingsService.getSettings();
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Settings retrieved', data: result });
});

const updateSettings = catchAsync(async (req, res) => {
  const result = await SettingsService.updateSettings(req.body);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Settings updated', data: result });
});

const resetDemo = catchAsync(async (req, res) => {
  const result = await SettingsService.resetDemoData(req.user.userId);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'Demo data cleared', data: result });
});

const deleteAll = catchAsync(async (req, res) => {
  const result = await SettingsService.deleteAllData(req.user.userId);
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: 'All business data deleted', data: result });
});

export const SettingsController = { getSettings, updateSettings, resetDemo, deleteAll };
