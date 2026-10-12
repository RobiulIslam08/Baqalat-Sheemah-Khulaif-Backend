import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AuthServices } from './auth.service';

const refreshCookie = {
  secure: false,
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 1000 * 60 * 60 * 24 * 365,
};

// ==================== REGISTRATION ====================
const register = catchAsync(async (req, res) => {
  const result = await AuthServices.registerUser(req.body);
  const { refreshToken, accessToken, user } = result;

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', refreshToken, refreshCookie);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'User registered successfully',
    data: {
      accessToken,
      refreshToken,
      user,
    },
  });
});

// ==================== LOGIN ====================
const loginUser = catchAsync(async (req, res) => {
  const result = await AuthServices.loginUser(req.body);
  const { refreshToken, accessToken, user } = result;

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', refreshToken, refreshCookie);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User logged in successfully',
    data: {
      accessToken,
      refreshToken,
      user,
    },
  });
});
// ==================== CHANGE PASSWORD ====================
const changePassword = catchAsync(async (req, res) => {
  const { ...passwordData } = req.body;
  const result = await AuthServices.changePassword(req.user, passwordData);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password changed successfully',
    data: result,
  });
});
// ==================== REFRESH TOKEN ====================
const refreshToken = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  const result = await AuthServices.refreshToken(token);
  if (result.refreshToken) {
    res.cookie('refreshToken', result.refreshToken, refreshCookie);
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Access token retrieved successfully',
    data: result,
  });
});

// ==================== FORGET PASSWORD ====================
const forgetPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await AuthServices.forgetPassword(email);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password reset link sent successfully',
    data: result,
  });
});

// ==================== RESET PASSWORD ====================
const resetPassword = catchAsync(async (req, res) => {
  const token = req.headers.authorization;
  const result = await AuthServices.resetPassword(req.body, token as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password reset successful',
    data: result,
  });
});

export const AuthControllers = {
  register,
  loginUser,
  changePassword,
  refreshToken,
  forgetPassword,
  resetPassword,
};
