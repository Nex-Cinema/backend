import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sendSuccess, sendCreated } from '../../../utils/response';
import {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  VerifyResetOtpInput,
  ResetPasswordInput,
} from './auth.validator';

// ========================
// POST /auth/register
// ========================
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = req.body as RegisterInput;
    const result = await authService.register(input);

    sendCreated(res, 'Đăng ký tài khoản thành công', result);
  } catch (error) {
    next(error);
  }
};

// ========================
// POST /auth/login
// ========================
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = req.body as LoginInput;
    const result = await authService.login(input);

    sendSuccess(res, 'Đăng nhập thành công', result);
  } catch (error) {
    next(error);
  }
};

// ========================
// POST /auth/refresh-token
// ========================
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = req.body as RefreshTokenInput;
    const result = await authService.refreshAccessToken(input);

    sendSuccess(res, 'Làm mới token thành công', result);
  } catch (error) {
    next(error);
  }
};

// ========================
// POST /auth/logout
// ========================
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const maTaiKhoan = req.user!.maTaiKhoan;
    const { refreshToken: token } = req.body as { refreshToken?: string };

    await authService.logout(maTaiKhoan, token);

    sendSuccess(res, 'Đăng xuất thành công');
  } catch (error) {
    next(error);
  }
};

// ========================
// GET /auth/me
// ========================
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const maTaiKhoan = req.user!.maTaiKhoan;
    const taiKhoan = await authService.getMe(maTaiKhoan);

    sendSuccess(res, 'Lấy thông tin tài khoản thành công', taiKhoan);
  } catch (error) {
    next(error);
  }
};

// ========================
// POST /auth/forgot-password
// ========================
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = req.body as ForgotPasswordInput;
    await authService.forgotPassword(input);

    sendSuccess(res, 'Nếu email tồn tại trong hệ thống, mã xác nhận đã được gửi.');
  } catch (error) {
    next(error);
  }
};

// ========================
// POST /auth/verify-reset-otp
// ========================
export const verifyResetOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = req.body as VerifyResetOtpInput;
    await authService.verifyResetOtp(input);

    sendSuccess(res, 'Mã xác nhận hợp lệ.');
  } catch (error) {
    next(error);
  }
};

// ========================
// POST /auth/reset-password
// ========================
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = req.body as ResetPasswordInput;
    await authService.resetPassword(input);

    sendSuccess(res, 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.');
  } catch (error) {
    next(error);
  }
};
