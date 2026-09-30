import { Request, Response } from 'express';
import * as phimService from './phim.service';
import { sendSuccess, sendCreated, sendPaginatedSuccess } from '../../../utils/response';
import { CreatePhimInput, UpdatePhimInput, PhimQueryInput } from './phim.validator';
import { asyncHandler } from '../../../utils/asyncHandler';

// ========================
// GET /api/v1/phim
// ========================
export const getDanhSachPhim = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as PhimQueryInput;
  const userRole = req.user?.vaiTro;

  const result = await phimService.getDanhSachPhim(query, userRole);

  return sendPaginatedSuccess(
    res,
    'Lấy danh sách phim thành công',
    result.items,
    {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  );
});

// ========================
// GET /api/v1/phim/:maPhim
// ========================
export const getChiTietPhim = asyncHandler(async (req: Request, res: Response) => {
  const { maPhim } = req.params as { maPhim: string };
  const userRole = req.user?.vaiTro;

  const phim = await phimService.getChiTietPhim(maPhim, userRole);

  return sendSuccess(res, 'Lấy chi tiết phim thành công', phim);
});

// ========================
// GET /api/v1/phim/:maPhim/suat-chieu
// ========================
export const getSuatChieuCuaPhim = asyncHandler(async (req: Request, res: Response) => {
  const { maPhim } = req.params as { maPhim: string };

  const suatChieus = await phimService.getSuatChieuCuaPhim(maPhim);

  return sendSuccess(
    res,
    'Lấy danh sách suất chiếu của phim thành công',
    suatChieus,
  );
});

// ========================
// POST /api/v1/phim
// ========================
export const taoPhim = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreatePhimInput;
  const phim = await phimService.taoPhim(input);

  return sendCreated(res, 'Tạo phim thành công', phim);
});

// ========================
// PUT /api/v1/phim/:maPhim
// ========================
export const capNhatPhim = asyncHandler(async (req: Request, res: Response) => {
  const { maPhim } = req.params as { maPhim: string };
  const input = req.body as UpdatePhimInput;
  const phim = await phimService.capNhatPhim(maPhim, input);

  return sendSuccess(res, 'Cập nhật phim thành công', phim);
});

// ========================
// PATCH /api/v1/phim/:maPhim/soft-delete
// ========================
export const anPhim = asyncHandler(async (req: Request, res: Response) => {
  const { maPhim } = req.params as { maPhim: string };
  const phim = await phimService.anPhim(maPhim);

  return sendSuccess(res, 'Ẩn phim thành công', phim);
});

// ========================
// PATCH /api/v1/phim/:maPhim/restore
// ========================
export const khoiPhucPhim = asyncHandler(async (req: Request, res: Response) => {
  const { maPhim } = req.params as { maPhim: string };
  const phim = await phimService.khoiPhucPhim(maPhim);

  return sendSuccess(res, 'Khôi phục phim thành công', phim);
});

// ========================
// DELETE /api/v1/phim/:maPhim
// ========================
export const xoaPhim = asyncHandler(async (req: Request, res: Response) => {
  const { maPhim } = req.params as { maPhim: string };
  await phimService.xoaPhim(maPhim);

  return sendSuccess(res, 'Xóa phim thành công');
});
