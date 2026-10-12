import httpStatus from 'http-status';
import jwt, { JwtPayload } from 'jsonwebtoken';
import config from '../../config';
import AppError from '../../errors/AppError';
import {
  IRegister,
  ILogin,
  IChangePassword,
  IAuthResponse,
} from './auth.interface';
import { createToken } from './auth.utils';
import { User } from '../User/user.model';
import { assertShopOpen } from '../License/license.service';

// ==================== REGISTRATION ====================
const registerUser = async (payload: IRegister): Promise<IAuthResponse> => {
  if ((payload as { role?: string }).role === 'developer') {
    throw new AppError(httpStatus.FORBIDDEN, 'Developer role cannot be assigned');
  }
  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [
      { email: payload.email },
      { userId: payload.userId },
      { username: payload.username },
    ],
  });

  if (existingUser) {
    throw new AppError(
      httpStatus.CONFLICT,
      'User with this email, userId, or username already exists',
    );
  }

  // Create new user
  const newUser = await User.create(payload);

  // Create JWT payload
  const jwtPayload = {
    userId: newUser.userId,
    role: newUser.role,
  };

  // Generate tokens
  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as string,
  );

  const refreshToken = createToken(
    jwtPayload,
    config.jwt_refresh_secret as string,
    config.jwt_refresh_expires_in as string,
  );

  return {
    accessToken,
    refreshToken,
    user: {
      _id: newUser._id.toString(),
      userId: newUser.userId,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
    },
  };
};

// ==================== LOGIN ====================
const loginUser = async (payload: ILogin): Promise<IAuthResponse> => {
  // Check if user exists in database (search by username)
  const user = await User.isUserExistsByUsername(payload.username);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Check if user is deleted
  if (User.isUserDeleted(user)) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user has been deleted');
  }

  // Check if user is blocked
  if (User.isUserBlocked(user)) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
  }

  // Check if password is correct
  const isPasswordMatched = await user.comparePassword(payload.password);

  if (!isPasswordMatched) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid username or password');
  }

  await assertShopOpen(user.role);

  // Create JWT payload (uses custom userId, not MongoDB _id)
  const jwtPayload = {
    userId: user.userId,
    role: user.role,
  };

  // Generate tokens
  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as string,
  );

  const refreshToken = createToken(
    jwtPayload,
    config.jwt_refresh_secret as string,
    config.jwt_refresh_expires_in as string,
  );

  return {
    accessToken,
    refreshToken,
    user: {
      _id: user._id.toString(),
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
  };
};

// ==================== CHANGE PASSWORD ====================
const changePassword = async (
  userData: JwtPayload,
  payload: IChangePassword,
): Promise<void> => {
  const user = await User.findOne({ userId: userData.userId }).select('+password');

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (User.isUserDeleted(user)) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user has been deleted');
  }

  if (User.isUserBlocked(user)) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
  }

  const isPasswordMatched = await user.comparePassword(payload.oldPassword);

  if (!isPasswordMatched) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Old password is incorrect');
  }

  user.password = payload.newPassword;
  user.passwordChangedAt = new Date();
  await user.save();
};

// ==================== REFRESH TOKEN ====================
const refreshToken = async (token: string) => {
  if (!token) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Refresh token is required');
  }

  const decoded = jwt.verify(
    token,
    config.jwt_refresh_secret as string,
  ) as JwtPayload;

  const { userId, iat } = decoded;

  const user = await User.findOne({ userId }).select('+password');

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (User.isUserDeleted(user)) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user has been deleted');
  }

  if (User.isUserBlocked(user)) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
  }

  if (
    user.passwordChangedAt &&
    User.isJWTIssuedBeforePasswordChanged(user.passwordChangedAt, iat as number)
  ) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized');
  }

  const jwtPayload = {
    userId: user.userId,
    role: user.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as string,
  );
  const refreshToken = createToken(
    jwtPayload,
    config.jwt_refresh_secret as string,
    config.jwt_refresh_expires_in as string,
  );

  return { accessToken, refreshToken };
};

// ==================== FORGET PASSWORD ====================
const forgetPassword = async (_email: string): Promise<void> => {
  throw new AppError(httpStatus.BAD_REQUEST, 'Password reset is not available on this offline till');
};

const resetPassword = async (
  _payload: { email: string; newPassword: string },
  _token: string,
): Promise<void> => {
  throw new AppError(httpStatus.BAD_REQUEST, 'Password reset is not available on this offline till');
};

export const AuthServices = {
  registerUser,
  loginUser,
  changePassword,
  refreshToken,
  forgetPassword,
  resetPassword,
};
