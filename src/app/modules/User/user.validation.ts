import { z } from 'zod';
import { SHOP_ROLES, USER_STATUS } from './user.interface';

// Create User (Admin creating a new POS user)
const createUserValidationSchema = z.object({
  body: z.object({
    userId: z.string({ message: 'User ID is required' }).trim(),
    username: z
      .string({ message: 'Username is required' })
      .min(3, { message: 'Username must be at least 3 characters' })
      .trim(),
    fullName: z
      .string({ message: 'Full name is required' })
      .min(2, { message: 'Full name must be at least 2 characters' })
      .max(100, { message: 'Full name cannot exceed 100 characters' })
      .trim(),
    email: z
      .string({ message: 'Email is required' })
      .email({ message: 'Invalid email address' })
      .toLowerCase()
      .trim(),
    password: z
      .string({ message: 'Password is required' })
      .min(6, { message: 'Password must be at least 6 characters' })
      .max(100, { message: 'Password cannot exceed 100 characters' }),
    role: z.enum(SHOP_ROLES).optional().default('cashier'),
    mobile: z.string({ message: 'Mobile number is required' }).trim(),
    address: z.string().trim().optional(),
    profileImage: z.string().url().optional(),
  }),
});

// Update User Profile
const updateUserValidationSchema = z.object({
  body: z.object({
    fullName: z
      .string()
      .min(2, { message: 'Full name must be at least 2 characters' })
      .max(100)
      .trim()
      .optional(),
    mobile: z.string().trim().optional(),
    address: z.string().trim().optional(),
    profileImage: z.string().url().optional(),
  }),
});

// Change Password
const changePasswordValidationSchema = z.object({
  body: z.object({
    oldPassword: z.string({ message: 'Old password is required' }),
    newPassword: z
      .string({ message: 'New password is required' })
      .min(6, { message: 'Password must be at least 6 characters' })
      .max(100, { message: 'Password cannot exceed 100 characters' }),
  }),
});

// Update User Status (Admin)
const updateUserStatusValidationSchema = z.object({
  body: z.object({
    status: z.enum(Object.values(USER_STATUS) as [string, ...string[]], {
      message: 'Status must be either active or blocked',
    }),
  }),
});

// Update User Role (Admin)
const updateUserRoleValidationSchema = z.object({
  body: z.object({
    role: z.enum(SHOP_ROLES, {
      message: 'Role must be admin, manager, or cashier',
    }),
  }),
});

export const UserValidation = {
  createUserValidationSchema,
  updateUserValidationSchema,
  changePasswordValidationSchema,
  updateUserStatusValidationSchema,
  updateUserRoleValidationSchema,
};
