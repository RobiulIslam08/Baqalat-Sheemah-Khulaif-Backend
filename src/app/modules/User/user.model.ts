import bcrypt from 'bcryptjs';
import config from '../../config';
import { createCollection } from '../../DB/collection';

export const User = createCollection('users', {
  softDelete: true,
  hidden: ['password'],
  async beforeSave(data) {
    if (typeof data.password === 'string' && data.password && !data.password.startsWith('$2')) {
      const rounds = Number(config.bcrypt_salt_rounds) || 12;
      data.password = await bcrypt.hash(data.password, rounds);
    }
  },
  methods: {
    comparePassword(candidate: string) {
      return bcrypt.compare(candidate, this.password);
    },
  },
}) as any;

User.isUserExistsByEmail = (email: string) => User.findOne({ email }).select('+password');
User.isUserExitsByCustomId = (userId: string) => User.findOne({ userId }).select('+password');
User.isUserExistsByUsername = (username: string) => User.findOne({ username }).select('+password');
User.isPasswordMatched = (plain: string, hashed: string) => bcrypt.compare(plain, hashed);
User.isUserDeleted = (user: { isDeleted?: boolean }) => user?.isDeleted === true;
User.isUserBlocked = (user: { status?: string }) => user?.status === 'blocked';
User.isJWTIssuedBeforePasswordChanged = (passwordChangedTimestamp: Date | string, jwtIssuedTimestamp: number) => {
  const passwordChangedTime = new Date(passwordChangedTimestamp).getTime() / 1000;
  return passwordChangedTime > jwtIssuedTimestamp;
};
