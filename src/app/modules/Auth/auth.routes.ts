import express from 'express';
import validateRequest from '../../middleware/validationRequest';
import { AuthValidation } from './auth.validation';
import { AuthControllers } from './auth.controller';
import auth from '../../middleware/auth';

const router = express.Router();

// ==================== REGISTRATION ====================
router.post(
  '/register',
  auth('admin'),
  validateRequest(AuthValidation.registerValidationSchema),
  AuthControllers.register,
);

// ==================== LOGIN ====================
router.post(
  '/login',
  validateRequest(AuthValidation.loginValidationSchema),
  AuthControllers.loginUser,
);

// ==================== CHANGE PASSWORD ====================
router.post(
  '/change-password',
  auth('admin', 'manager', 'cashier'),
  validateRequest(AuthValidation.changePasswordValidationSchema),
  AuthControllers.changePassword,
);

// ==================== REFRESH TOKEN ====================
router.post(
  '/refresh-token',
  validateRequest(AuthValidation.refreshTokenValidationSchema),
  AuthControllers.refreshToken,
);

// ==================== FORGET PASSWORD ====================
router.post(
  '/forget-password',
  validateRequest(AuthValidation.forgetPasswordValidationSchema),
  AuthControllers.forgetPassword,
);

// ==================== RESET PASSWORD ====================
router.post(
  '/reset-password',
  validateRequest(AuthValidation.resetPasswordValidationSchema),
  AuthControllers.resetPassword,
);

export const AuthRoutes = router;
