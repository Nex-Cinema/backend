import { Request, Response } from 'express';
import * as lichSuService from './lichsu.service';
import { sendSuccess } from '../../../utils/response';
import { asyncHandler } from '../../../utils/asyncHandler';
import { BookingHistoryQueryInput } from './lichsu.validator';

/**
 * GET /api/v1/lich-su-giao-dich
 */
export const getLichSuGiaoDich = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as BookingHistoryQueryInput;
  const maTaiKhoan = req.user!.maTaiKhoan;

  const result = await lichSuService.getLichSuGiaoDich(maTaiKhoan, query);

  return res.status(200).json({
    success: true,
    message: 'Lấy lịch sử giao dịch thành công',
    data: result.items,
    pagination: result.pagination,
  });
});

/**
 * GET /api/v1/lich-su-giao-dich/:maPhieuDat
 */
export const getChiTietLichSu = asyncHandler(async (req: Request, res: Response) => {
  const { maPhieuDat } = req.params as { maPhieuDat: string };
  const maTaiKhoan = req.user!.maTaiKhoan;

  const result = await lichSuService.getChiTietLichSu(maPhieuDat, maTaiKhoan);

  return sendSuccess(res, 'Lấy chi tiết giao dịch thành công', result);
});
