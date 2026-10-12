import httpStatus from 'http-status';
import express from 'express';
import auth from '../../middleware/auth';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import {
  changeDeveloperPassword,
  getLicenseStatus,
  resetAdminPassword,
  updateLicense,
} from './license.service';

const router = express.Router();

const publicStatus = catchAsync(async (_req, res) => {
  const result = await getLicenseStatus();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'License status',
    data: result,
  });
});

const update = catchAsync(async (req, res) => {
  const result = await updateLicense(req.body, req.user?.userId || 'developer');
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'License updated',
    data: result,
  });
});

const resetAdmin = catchAsync(async (req, res) => {
  await resetAdminPassword(req.body?.password);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Shop admin password reset',
    data: null,
  });
});

const changeDeveloper = catchAsync(async (req, res) => {
  await changeDeveloperPassword(req.user?.userId, req.body?.oldPassword, req.body?.newPassword);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Developer password changed',
    data: null,
  });
});

router.get('/status', publicStatus);
router.patch('/', auth('developer'), update);
router.post('/reset-admin-password', auth('developer'), resetAdmin);
router.post('/change-developer-password', auth('developer'), changeDeveloper);

export const LicenseRoutes = router;
