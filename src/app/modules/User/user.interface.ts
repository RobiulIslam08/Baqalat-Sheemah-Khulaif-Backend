import { Document, Model } from 'mongoose';

// POS User Roles
export const USER_ROLE = {
  admin: 'admin',
  manager: 'manager',
  cashier: 'cashier',
  developer: 'developer',
} as const;

export const SHOP_ROLES = ['admin', 'manager', 'cashier'] as const;

export type TUserRole = keyof typeof USER_ROLE;

// User Status
export const USER_STATUS = {
  active: 'active',
  blocked: 'blocked',
} as const;

export type TUserStatus = keyof typeof USER_STATUS;

// Main User Interface
export interface IUser {
  userId: string; // Custom ID like U-100
  username: string;
  fullName: string;
  email: string;
  password: string;
  role: TUserRole;
  status: TUserStatus;
  mobile: string;
  address?: string;
  profileImage?: string;
  passwordChangedAt?: Date;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// User Document Interface (for Mongoose)
export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// User Model Interface (for static methods)
export interface IUserModel extends Model<IUserDocument> {
  isUserExistsByEmail(email: string): Promise<IUserDocument | null>;
  isUserExitsByCustomId(userId: string): Promise<IUserDocument | null>;
  isUserExistsByUsername(username: string): Promise<IUserDocument | null>;
  isPasswordMatched(
    plainTextPassword: string,
    hashedPassword: string,
  ): Promise<boolean>;
  isUserDeleted(user: IUserDocument): boolean;
  isUserBlocked(user: IUserDocument): boolean;
  isJWTIssuedBeforePasswordChanged(
    passwordChangedTimestamp: Date,
    jwtIssuedTimestamp: number,
  ): boolean;
}
