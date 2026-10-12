import httpStatus from 'http-status';
import { User } from './user.model';
import { IUser } from './user.interface';
import AppError from '../../errors/AppError';
import QueryBuilder from '../../utils/QueryBuilder';

const userSearchableFields = ['fullName', 'email', 'username', 'userId', 'mobile'];

// Create user (Admin only)
const createUserIntoDB = async (payload: IUser) => {
  if (payload.role === 'developer') {
    throw new AppError(httpStatus.FORBIDDEN, 'Developer role cannot be assigned');
  }
  // Check if userId or username or email already exists
  const existingUser = await User.findOne({
    $or: [
      { userId: payload.userId },
      { username: payload.username },
      { email: payload.email },
    ],
  });

  if (existingUser) {
    throw new AppError(
      httpStatus.CONFLICT,
      'User with this ID, username, or email already exists',
    );
  }

  const result = await User.create(payload);
  return result;
};

// Get all users with search/filter/pagination
const getAllUsersFromDB = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(User.find({ role: { $ne: 'developer' } }), query)
    .search(userSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery;
  const meta = await userQuery.countTotal();
  return { meta, data: result };
};

// Get single user by MongoDB ID
const getSingleUserFromDB = async (id: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  return user;
};

// Get current user profile
const getUserProfile = async (userId: string) => {
  const user = await User.findOne({ userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  return user;
};

// Update user profile
const updateUserProfile = async (
  userId: string,
  payload: Partial<IUser>,
) => {
  const user = await User.findOne({ userId });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Prevent updating sensitive fields
  const restrictedFields = [
    'email',
    'password',
    'role',
    'isDeleted',
    'userId',
    'username',
  ];
  restrictedFields.forEach((field) => {
    if (field in payload) {
      delete payload[field as keyof IUser];
    }
  });

  const updatedUser = await User.findOneAndUpdate({ userId }, payload, {
    new: true,
    runValidators: true,
  });

  if (!updatedUser) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update user',
    );
  }

  return updatedUser;
};

// Change password
const changePassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string,
) => {
  const user = await User.findOne({ userId }).select('+password');
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const isPasswordMatched = await user.comparePassword(oldPassword);
  if (!isPasswordMatched) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Old password is incorrect');
  }

  user.password = newPassword;
  user.passwordChangedAt = new Date();
  await user.save();
};

// Update user status (Admin only)
const updateUserStatus = async (id: string, status: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (user.role === 'developer') {
    throw new AppError(httpStatus.FORBIDDEN, 'Developer account cannot be changed here');
  }

  user.status = status as any;
  await user.save();
  return user;
};

// Update user role (Admin only)
const updateUserRole = async (id: string, role: string) => {
  if (role === 'developer') {
    throw new AppError(httpStatus.FORBIDDEN, 'Developer role cannot be assigned');
  }

  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (user.role === 'developer') {
    throw new AppError(httpStatus.FORBIDDEN, 'Developer account cannot be changed here');
  }

  user.role = role as any;
  await user.save();
  return user;
};

// Soft delete user
const deleteUser = async (id: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (user.role === 'developer') {
    throw new AppError(httpStatus.FORBIDDEN, 'Developer account cannot be deleted');
  }

  user.isDeleted = true;
  await user.save();
};

export const UserService = {
  createUserIntoDB,
  getAllUsersFromDB,
  getSingleUserFromDB,
  getUserProfile,
  updateUserProfile,
  changePassword,
  updateUserStatus,
  updateUserRole,
  deleteUser,
};
