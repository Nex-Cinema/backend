import { Request, Response } from 'express';
import * as phongChieuService from './phongchieu.service';
import { sendSuccess, sendCreated } from '../../../utils/response';
import {
  CreatePhongChieuInput,
  UpdatePhongChieuInput,
  UpdateGhesInput,
} from './phongchieu.validator';
import { asyncHandler } from '../../../utils/asyncHandler';

// ==========================================
// 1. PHÒNG CHIẾU (Screening Room) CONTROLLERS
// ==========================================

export const getDanhSachPhongChieu = asyncHandler(async (req: Request, res: Response) => {
  const result = await phongChieuService.getDanhSachPhongChieu();
  return sendSuccess(res, 'Lấy danh sách phòng chiếu thành công', result);
});

export const getChiTietPhongChieu = asyncHandler(async (req: Request, res: Response) => {
  const { maPhong } = req.params as { maPhong: string };
  const result = await phongChieuService.getChiTietPhongChieu(maPhong);
  return sendSuccess(res, 'Lấy thông tin chi tiết phòng chiếu thành công', result);
});

export const taoPhongChieu = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreatePhongChieuInput;
  const result = await phongChieuService.taoPhongChieu(input);
  return sendCreated(res, 'Tạo phòng chiếu thành công', result);
});

export const capNhatPhongChieu = asyncHandler(async (req: Request, res: Response) => {
  const { maPhong } = req.params as { maPhong: string };
  const input = req.body as UpdatePhongChieuInput;
  const result = await phongChieuService.capNhatPhongChieu(maPhong, input);
  return sendSuccess(res, 'Cập nhật phòng chiếu thành công', result);
});

export const xoaPhongChieu = asyncHandler(async (req: Request, res: Response) => {
  const { maPhong } = req.params as { maPhong: string };
  await phongChieuService.xoaPhongChieu(maPhong);
  return sendSuccess(res, 'Xóa phòng chiếu thành công');
});

// ==========================================
// 2. GHẾ (Seat Layout) CONTROLLERS
// ==========================================

export const getDanhSachGhe = asyncHandler(async (req: Request, res: Response) => {
  const { maPhong } = req.params as { maPhong: string };
  const result = await phongChieuService.getDanhSachGhe(maPhong);
  return sendSuccess(res, 'Lấy danh sách ghế của phòng chiếu thành công', result);
});

export const capNhatCauHinhGhe = asyncHandler(async (req: Request, res: Response) => {
  const { maPhong } = req.params as { maPhong: string };
  const input = req.body as UpdateGhesInput;
  await phongChieuService.capNhatCauHinhGhe(maPhong, input);
  return sendSuccess(res, 'Cập nhật cấu hình ghế thành công');
});
