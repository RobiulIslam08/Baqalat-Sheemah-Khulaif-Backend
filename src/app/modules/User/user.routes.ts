import express from 'express';
import { UserController } from './user.controller';
import validateRequest from '../../middleware/validationRequest';
import { UserValidation } from './user.validation';
import auth from '../../middleware/auth';

const router = express.Router();

// Create user (Admin only)
router.post(
  '/',
  auth('admin'),
  validateRequest(UserValidation.createUserValidationSchema),
  UserController.createUser,
);

// Get all users (Admin only)
router.get('/', auth('admin'), UserController.getAllUsers);

// Get my profile
router.get('/me', auth('admin', 'manager', 'cashier'), UserController.getMyProfile);

// Update my profile
router.patch(
  '/me',
  auth('admin', 'manager', 'cashier'),
  validateRequest(UserValidation.updateUserValidationSchema),
  UserController.updateMyProfile,
);

// Change password
router.post(
  '/change-password',
  auth('admin', 'manager', 'cashier'),
  validateRequest(UserValidation.changePasswordValidationSchema),
  UserController.changePassword,
);

// Get single user by ID (Admin only)
router.get('/:id', auth('admin'), UserController.getSingleUser);

// Update user status (Admin only)
router.patch(
  '/:id/status',
  auth('admin'),
  validateRequest(UserValidation.updateUserStatusValidationSchema),
  UserController.updateUserStatus,
);

// Update user role (Admin only)
router.patch(
  '/:id/role',
  auth('admin'),
  validateRequest(UserValidation.updateUserRoleValidationSchema),
  UserController.updateUserRole,
);

// Delete user (Admin only)
router.delete('/:id', auth('admin'), UserController.deleteUser);

export const UserRoutes = router;
