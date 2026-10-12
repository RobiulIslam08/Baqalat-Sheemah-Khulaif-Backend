import { NextFunction, Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import jwt, { JwtPayload } from 'jsonwebtoken';
import config from '../config';
import { TUserRole } from '../modules/User/user.interface';
import { User } from '../modules/User/user.model';
import { assertShopOpen, assertCanModify } from '../modules/License/license.service';

const auth = (...requiredRoles: TUserRole[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization;
    // ... rest of the code commented out or ignored

    // Check if token exists and has Bearer prefix
    if (!token || !token.startsWith('Bearer ')) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
    }

    const accessToken = token.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(
      accessToken,
      config.jwt_access_secret as string,
    ) as JwtPayload;

    const { role, userId, iat } = decoded;

    const user = await User.isUserExitsByCustomId(userId);

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'This user is not found!');
    }

    // Check if user is deleted
    if (user?.isDeleted) {
      throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted!');
    }

    // Check if user is blocked
    if (user?.status === 'blocked') {
      throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked!');
    }

    // Check if JWT was issued before password change
    if (
      user.passwordChangedAt &&
      User.isJWTIssuedBeforePasswordChanged(
        user.passwordChangedAt,
        iat as number,
      )
    ) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
    }

    await assertShopOpen(role);

    // If read-only maintenance mode is active, block non-developer mutation requests (POST, PUT, PATCH, DELETE)
    if (role !== 'developer' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      await assertCanModify(role);
    }

    // Developer can open every screen. Shop roles stay limited to their routes.
    if (requiredRoles.length && role !== 'developer' && !requiredRoles.includes(role)) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You do not have permission to perform this action!',
      );
    }

    req.user = decoded as JwtPayload & { role: string };
    next();
  });
};

export default auth;