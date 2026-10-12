import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export default {
  port: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  database_url: process.env.DATABASE_URL,
  bcrypt_salt_rounds: process.env.BCYPT_SALT_ROUNDS,
  default_pass: process.env.DEFAULT_PASS || 'pos@123456',
  jwt_access_secret: process.env.JWT_ACCESS_SECRET,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
  reset_pass_ui_link: process.env.RESET_PASS_UI_LINK,
  frontend_url: process.env.FRONTEND_URL || 'http://localhost:6100',
  admin_username: process.env.ADMIN_USERNAME || 'admin',
  admin_password: process.env.ADMIN_PASSWORD || 'admin123',
  license_secret: process.env.LICENSE_SECRET || 'sheemah-khulaif-aayed-pos-license-v1',
  developer_password: process.env.DEVELOPER_PASSWORD || 'Dev@SheemahPOS',
  db_type: process.env.DB_TYPE || (process.env.DB_NAME ? 'mysql' : 'sqlite'),
  db_host: process.env.DB_HOST || 'localhost',
  db_port: Number(process.env.DB_PORT) || 3306,
  db_user: process.env.DB_USER || 'root',
  db_pass: process.env.DB_PASS || '',
  db_name: process.env.DB_NAME || 'shimakhalip',
};
