import { Request, Response } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler';
import { sendSuccess } from '../../../utils/response';
import * as staffHoSoService from './staffHoSo.service';
import {
  UpdateStaffProfileInput,
  ChangeStaffPasswordInput,
} from './staffHoSo.validator';

/**
 * GET /api/v1/staff/ho-so
 * Retrieve the authenticated staff member's own profile
 */
export const getHoSo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const maTaiKhoan = req.user!.maTaiKhoan;

  const profile = await staffHoSoService.getStaffProfile(maTaiKhoan);

  sendSuccess(res, 'Lấy hồ sơ nhân viên thành công', profile);
});

/**
 * PUT /api/v1/staff/ho-so
 * Update the authenticated staff member's own profile
 */
export const capNhatHoSo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const maTaiKhoan = req.user!.maTaiKhoan;
  const input = req.body as UpdateStaffProfileInput;

  const profile = await staffHoSoService.updateStaffProfile(maTaiKhoan, input);

  sendSuccess(res, 'Cập nhật hồ sơ nhân viên thành công', profile);
});

/**
 * PUT /api/v1/staff/doi-mat-khau
 * Change the authenticated staff member's password (revokes all refresh tokens)
 */
export const doiMatKhau = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const maTaiKhoan = req.user!.maTaiKhoan;
  const input = req.body as ChangeStaffPasswordInput;

  await staffHoSoService.changeStaffPassword(maTaiKhoan, input);

  sendSuccess(res, 'Đổi mật khẩu thành công');
});
