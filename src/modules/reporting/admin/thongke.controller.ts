import { Request, Response } from 'express';
import * as statsService from './thongke.service';
import { sendSuccess } from '../../../utils/response';
import { StatsQueryInput } from './thongke.validator';
import { asyncHandler } from '../../../utils/asyncHandler';

export const getDoanhThuStats = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as StatsQueryInput;
  const result = await statsService.getDoanhThuStats(query);
  return sendSuccess(res, 'Thống kê doanh thu thành công', result);
});

export const getFillRateStats = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as Omit<StatsQueryInput, 'maPhim'>;
  const result = await statsService.getFillRateStats(query);
  return sendSuccess(res, 'Thống kê tỉ lệ lấp đầy ghế thành công', result);
});
