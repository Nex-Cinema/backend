import { Request, Response, NextFunction } from 'express';
import * as taiKhoanService from './taikhoan.service';
import { sendSuccess } from '../../../utils/response';
import { UpdateProfileInput, ChangePasswordInput } from './taikhoan.validator';

/**
 * GET /api/v1/tai-khoan/thong-tin
 * Lấy thông tin tài khoản hiện tại (khách hàng)
 */
export const getThongTinTaiKhoan = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const maTaiKhoan = req.user!.maTaiKhoan;
    const profile = await taiKhoanService.getCurrentCustomerProfile(maTaiKhoan);

    sendSuccess(res, 'Lấy thông tin tài khoản thành công', profile);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/tai-khoan/thong-tin
 * Cập nhật thông tin tài khoản hiện tại (khách hàng)
 */
export const capNhatThongTinTaiKhoan = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const maTaiKhoan = req.user!.maTaiKhoan;
    const input = req.body as UpdateProfileInput;
    const profile = await taiKhoanService.updateCurrentCustomerProfile(maTaiKhoan, input);

    sendSuccess(res, 'Cập nhật thông tin tài khoản thành công', profile);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/tai-khoan/doi-mat-khau
 * Đổi mật khẩu tài khoản hiện tại (khách hàng)
 */
export const doiMatKhau = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const maTaiKhoan = req.user!.maTaiKhoan;
    const input = req.body as ChangePasswordInput;
    await taiKhoanService.changeCurrentCustomerPassword(maTaiKhoan, input);

    sendSuccess(res, 'Đổi mật khẩu thành công');
  } catch (error) {
    next(error);
  }
};
