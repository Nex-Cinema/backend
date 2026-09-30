import { Request, Response } from 'express';
import * as suatChieuService from './suatchieu.service';
import { sendSuccess, sendCreated } from '../../../utils/response';
import { CreateSuatChieuInput, UpdateSuatChieuInput } from './suatchieu.validator';
import { asyncHandler } from '../../../utils/asyncHandler';

export const getDanhSachSuatChieu = asyncHandler(async (req: Request, res: Response) => {
  const { maPhim, maPhong, ngayChieu, khaDung } = req.query;

  const filters: any = {};
  if (typeof maPhim === 'string') filters.maPhim = maPhim;
  if (typeof maPhong === 'string') filters.maPhong = maPhong;
  if (typeof ngayChieu === 'string') {
    const parsedDate = new Date(ngayChieu);
    if (!isNaN(parsedDate.getTime())) {
      filters.ngayChieu = parsedDate;
    }
  }
  if (khaDung !== undefined) {
    filters.khaDung = khaDung === 'true';
  }

  const result = await suatChieuService.getSuatChieus(filters);
  return sendSuccess(res, 'Lấy danh sách suất chiếu thành công', result);
});

export const getChiTietSuatChieu = asyncHandler(async (req: Request, res: Response) => {
  const { maSuatChieu } = req.params as { maSuatChieu: string };
  const result = await suatChieuService.getSuatChieuById(maSuatChieu);
  return sendSuccess(res, 'Lấy chi tiết suất chiếu thành công', result);
});

export const taoSuatChieu = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateSuatChieuInput;
  const result = await suatChieuService.createSuatChieuService(input);
  return sendCreated(res, 'Tạo suất chiếu thành công', result);
});

export const capNhatSuatChieu = asyncHandler(async (req: Request, res: Response) => {
  const { maSuatChieu } = req.params as { maSuatChieu: string };
  const input = req.body as UpdateSuatChieuInput;
  const result = await suatChieuService.updateSuatChieuService(maSuatChieu, input);
  return sendSuccess(res, 'Cập nhật suất chiếu thành công', result);
});

export const xoaSuatChieu = asyncHandler(async (req: Request, res: Response) => {
  const { maSuatChieu } = req.params as { maSuatChieu: string };
  await suatChieuService.deleteSuatChieuService(maSuatChieu);
  return sendSuccess(res, 'Xóa suất chiếu thành công');
});

export const getDanhSachGheSuatChieu = asyncHandler(async (req: Request, res: Response) => {
  const { maSuatChieu } = req.params as { maSuatChieu: string };
  const result = await suatChieuService.getSeatsOfShowtimeService(maSuatChieu);
  return sendSuccess(res, 'Lấy danh sách ghế của suất chiếu thành công', result);
});

/**
 * GET /api/v1/suat-chieu/:maSuatChieu/ghe
 */
export const getSeatMap = asyncHandler(async (req: Request, res: Response) => {
  const { maSuatChieu } = req.params as { maSuatChieu: string };
  const seatMap = await suatChieuService.getSeatMap(maSuatChieu);

  return sendSuccess(res, 'Lấy sơ đồ ghế thành công', seatMap);
});
