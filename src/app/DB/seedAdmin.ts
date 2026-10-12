import config from '../config';
import { USER_ROLE, USER_STATUS } from '../modules/User/user.interface';
import { User } from '../modules/User/user.model';

const adminUser = {
  userId: 'admin',
  username: 'admin',
  fullName: 'System Admin',
  email: 'admin@baqalat-sheemah.com',
  password: 'admin123',
  role: USER_ROLE.admin,
  status: USER_STATUS.active,
  mobile: '01700000000',
  address: 'Dhaka, Bangladesh',
};

const seedAdmin = async () => {
  // Check if any admin exists
  const isAdminExists = await User.findOne({ role: USER_ROLE.admin });

  if (!isAdminExists) {
    await User.create(adminUser);
    console.log('✅ Admin user seeded successfully');
    console.log('User ID: admin');
    console.log('Password: admin123');
  }

  const developerExists = await User.findOne({ role: USER_ROLE.developer });
  if (!developerExists) {
    await User.create({
      userId: 'developer',
      username: 'developer',
      fullName: 'System Developer',
      email: 'developer@baqalat-sheemah.com',
      password: config.developer_password,
      role: USER_ROLE.developer,
      status: USER_STATUS.active,
      mobile: '00000000000',
      address: 'Developer',
    });
    console.log('✅ Developer user ready');
    console.log('Username: developer');
  }
};

export default seedAdmin;
