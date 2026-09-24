import { Request, Response } from 'express';
import * as userService from './user.service';
import { sendSuccess, sendCreated, sendPaginatedSuccess } from '../../../utils/response';
import {
  CreateUserInput,
  UpdateUserInput,
  AdminChangePasswordInput,
  UserQueryInput,
} from './user.validator';
import { asyncHandler } from '../../../utils/asyncHandler';

export const getDanhSachNguoiDung = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as UserQueryInput;
  const result = await userService.getDanhSachNguoiDung(query);

  return sendPaginatedSuccess(
    res,
    'Lấy danh sách người dùng thành công',
    result.items,
    {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  );
});

export const getChiTietNguoiDung = asyncHandler(async (req: Request, res: Response) => {
  const { maTaiKhoan } = req.params as { maTaiKhoan: string };
  const result = await userService.getChiTietNguoiDung(maTaiKhoan);

  return sendSuccess(res, 'Lấy chi tiết người dùng thành công', result);
});

export const taoNguoiDung = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateUserInput;
  const result = await userService.taoNguoiDung(input);

  return sendCreated(res, 'Tạo người dùng thành công', result);
});

export const capNhatNguoiDung = asyncHandler(async (req: Request, res: Response) => {
  const { maTaiKhoan } = req.params as { maTaiKhoan: string };
  const input = req.body as UpdateUserInput;
  const result = await userService.capNhatNguoiDung(maTaiKhoan, input);

  return sendSuccess(res, 'Cập nhật người dùng thành công', result);
});

export const adminDoiMatKhau = asyncHandler(async (req: Request, res: Response) => {
  const { maTaiKhoan } = req.params as { maTaiKhoan: string };
  const input = req.body as AdminChangePasswordInput;
  await userService.adminDoiMatKhau(maTaiKhoan, input);

  return sendSuccess(res, 'Đặt lại mật khẩu người dùng thành công');
});

export const xoaNguoiDung = asyncHandler(async (req: Request, res: Response) => {
  const { maTaiKhoan } = req.params as { maTaiKhoan: string };
  const { action, data } = await userService.xoaNguoiDung(maTaiKhoan);

  const msg =
    action === 'soft'
      ? 'Người dùng đã có lịch sử ca làm việc/giao dịch nên chỉ vô hiệu hóa tài khoản'
      : 'Xóa tài khoản người dùng vĩnh viễn thành công';

  return sendSuccess(res, msg, data);
});
