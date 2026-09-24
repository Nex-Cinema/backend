import { Request, Response } from 'express';
import * as danhGiaService from './danhgia.service';
import { sendSuccess } from '../../../utils/response';
import { asyncHandler } from '../../../utils/asyncHandler';
import { CreateReviewInput, MovieReviewQueryInput } from './danhgia.validator';

/**
 * POST /api/v1/danh-gia
 */
export const taoDanhGia = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateReviewInput;
  const maTaiKhoan = req.user!.maTaiKhoan;

  const result = await danhGiaService.taoDanhGia(maTaiKhoan, input);

  return sendSuccess(res, 'Đánh giá phim thành công', result);
});

/**
 * GET /api/v1/phim/:maPhim/danh-gia
 */
export const getDanhSachDanhGia = asyncHandler(async (req: Request, res: Response) => {
  const { maPhim } = req.params as { maPhim: string };
  const query = req.query as unknown as MovieReviewQueryInput;

  const result = await danhGiaService.getDanhSachDanhGia(maPhim, query);

  return res.status(200).json({
    success: true,
    message: 'Lấy danh sách đánh giá thành công',
    data: result.items,
    ratingSummary: result.ratingSummary,
    pagination: result.pagination,
  });
});
