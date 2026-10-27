// Same shapes as AuthModels.cs, with camelCase names

// NEW (4C): the two kinds of account, same names as UserRoles in Customer.cs
export type UserRole = 'Customer' | 'Admin';

export interface CustomerProfile {
  id: number;
  fullName: string;
  email: string;
  mobile: string;
  role: UserRole;           // NEW (4C)
}

// What register and login send back
export interface AuthResponse {
  token: string;            // sent with every API request: "Authorization: Bearer <token>"
  expiresAt: string;        // when the login ends (7 days)
  customer: CustomerProfile;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
}
export interface UpdateProfileRequest {
  fullName: string;
  mobile: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}