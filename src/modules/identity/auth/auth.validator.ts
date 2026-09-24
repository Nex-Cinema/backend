import { z } from 'zod';

// ========================
// Register Validator
// ========================
export const registerSchema = z.object({
  TenDangNhap: z
    .string({ required_error: 'Tên đăng nhập là bắt buộc' })
    .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự')
    .max(50, 'Tên đăng nhập tối đa 50 ký tự')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Tên đăng nhập chỉ chứa chữ cái, số và dấu gạch dưới',
    ),

  MatKhau: z
    .string({ required_error: 'Mật khẩu là bắt buộc' })
    .min(6, 'Mật khẩu phải có ít nhất 6 ký tự')
    .max(100, 'Mật khẩu tối đa 100 ký tự'),

  HoTen: z
    .string({ required_error: 'Họ tên là bắt buộc' })
    .min(2, 'Họ tên phải có ít nhất 2 ký tự')
    .max(100, 'Họ tên tối đa 100 ký tự'),

  Email: z
    .string({ required_error: 'Email là bắt buộc' })
    .email('Email không đúng định dạng')
    .max(255, 'Email tối đa 255 ký tự'),

  SoDienThoai: z
    .string({ required_error: 'Số điện thoại là bắt buộc' })
    .regex(/^(0|\+84)[0-9]{9}$/, 'Số điện thoại không hợp lệ'),

  GioiTinh: z.boolean().optional(),

  NgaySinh: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine(
      (val) => !val || !isNaN(val.getTime()),
      'Ngày sinh không hợp lệ',
    ),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ========================
// Login Validator
// ========================
export const loginSchema = z.object({
  TenDangNhap: z
    .string({ required_error: 'Tên đăng nhập là bắt buộc' })
    .min(1, 'Tên đăng nhập không được để trống'),

  MatKhau: z
    .string({ required_error: 'Mật khẩu là bắt buộc' })
    .min(1, 'Mật khẩu không được để trống'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ========================
// Refresh Token Validator
// ========================
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: 'Refresh token là bắt buộc' })
    .min(1, 'Refresh token không được để trống'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

// ========================
// Forgot Password Validator
// ========================
export const forgotPasswordSchema = z.object({
  Email: z
    .string({ required_error: 'Email là bắt buộc' })
    .email('Email không đúng định dạng')
    .max(255, 'Email tối đa 255 ký tự'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ========================
// Verify Reset OTP Validator
// ========================
export const verifyResetOtpSchema = z.object({
  Email: z
    .string({ required_error: 'Email là bắt buộc' })
    .email('Email không đúng định dạng')
    .max(255, 'Email tối đa 255 ký tự'),
  Otp: z
    .string({ required_error: 'Mã xác nhận là bắt buộc' })
    .regex(/^[0-9]{6}$/, 'Mã xác nhận phải gồm 6 chữ số'),
});

export type VerifyResetOtpInput = z.infer<typeof verifyResetOtpSchema>;

// ========================
// Reset Password Validator
// ========================
export const resetPasswordSchema = z.object({
  Email: z
    .string({ required_error: 'Email là bắt buộc' })
    .email('Email không đúng định dạng')
    .max(255, 'Email tối đa 255 ký tự'),
  Otp: z
    .string({ required_error: 'Mã xác nhận là bắt buộc' })
    .regex(/^[0-9]{6}$/, 'Mã xác nhận phải gồm 6 chữ số'),
  MatKhauMoi: z
    .string({ required_error: 'Mật khẩu mới là bắt buộc' })
    .min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự')
    .max(100, 'Mật khẩu mới tối đa 100 ký tự'),
  XacNhanMatKhauMoi: z
    .string({ required_error: 'Xác nhận mật khẩu mới là bắt buộc' })
    .min(1, 'Xác nhận mật khẩu mới không được để trống'),
}).refine(data => data.MatKhauMoi === data.XacNhanMatKhauMoi, {
  message: 'Xác nhận mật khẩu mới không trùng khớp',
  path: ['XacNhanMatKhauMoi'],
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
