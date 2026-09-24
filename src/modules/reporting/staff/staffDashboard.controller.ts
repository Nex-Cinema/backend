import { Request, Response } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler';
import { sendSuccess } from '../../../utils/response';
import * as staffDashboardService from './staffDashboard.service';

export const getDashboardData = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const maTaiKhoan = req.user!.maTaiKhoan;
  const data = await staffDashboardService.getDashboardData(maTaiKhoan);
  sendSuccess(res, 'Lấy dữ liệu tổng quan ca làm việc thành công', data);
});
