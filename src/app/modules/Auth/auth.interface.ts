// Registration Interface
export interface IRegister {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  password: string;
  mobile: string;
  address?: string;
}

// Login Interface
export interface ILogin {
  username: string;
  password: string;
}

// Change Password Interface
export interface IChangePassword {
  oldPassword: string;
  newPassword: string;
}

// Auth Response Interface
export interface IAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    _id: string;
    userId: string;
    fullName: string;
    email: string;
    role: string;
  };
}
