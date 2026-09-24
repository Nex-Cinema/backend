import { Request, Response } from 'express';
import * as datVeService from './datve.service';
import { sendSuccess } from '../../../utils/response';
import { asyncHandler } from '../../../utils/asyncHandler';
import {
  SeatHoldInput,
  PaymentSimulationInput,
  RealPaymentInput,
  CancelBookingBody,
} from './datve.validator';

/**
 * POST /api/v1/dat-ve/giu-ghe
 */
export const giuGhe = asyncHandler(async (req: Request, res: Response) => {
  const { MaSuatChieu, DanhSachMaGheSuatChieu } = req.body as SeatHoldInput;
  const maTaiKhoan = req.user!.maTaiKhoan;

  const result = await datVeService.giuGhe(MaSuatChieu, DanhSachMaGheSuatChieu, maTaiKhoan);

  return sendSuccess(res, 'Giữ ghế thành công', result);
});

/**
 * POST /api/v1/dat-ve/huy-giu-ghe
 */
export const huyGiuGhe = asyncHandler(async (req: Request, res: Response) => {
  const { MaSuatChieu, DanhSachMaGheSuatChieu } = req.body as SeatHoldInput;
  const maTaiKhoan = req.user!.maTaiKhoan;

  const result = await datVeService.huyGiuGhe(MaSuatChieu, DanhSachMaGheSuatChieu, maTaiKhoan);

  return sendSuccess(res, 'Huỷ giữ ghế thành công', result);
});

/**
 * POST /api/v1/dat-ve/thanh-toan-gia-lap
 */
export const thanhToanGiaLap = asyncHandler(async (req: Request, res: Response) => {
  const {
    MaSuatChieu,
    DanhSachMaGheSuatChieu,
    PhuongThucThanhToan,
    KetQuaThanhToan,
  } = req.body as PaymentSimulationInput;
  const maTaiKhoan = req.user!.maTaiKhoan;

  const result = await datVeService.thanhToanGiaLap(
    MaSuatChieu,
    DanhSachMaGheSuatChieu,
    PhuongThucThanhToan,
    KetQuaThanhToan,
    maTaiKhoan,
  );

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.message,
    });
  }

  return sendSuccess(res, result.message, result.data);
});

/**
 * POST /api/v1/dat-ve/thanh-toan
 */
export const thanhToan = asyncHandler(async (req: Request, res: Response) => {
  const { MaSuatChieu, DanhSachMaGheSuatChieu, PhuongThucThanhToan } = req.body as RealPaymentInput;
  const maTaiKhoan = req.user!.maTaiKhoan;

  const result = await datVeService.thanhToan(
    MaSuatChieu,
    DanhSachMaGheSuatChieu,
    PhuongThucThanhToan,
    maTaiKhoan,
  );

  return sendSuccess(res, result.message, result.data);
});

/**
 * POST /api/v1/dat-ve/:maPhieuDat/huy
 */
export const huyDatVe = asyncHandler(async (req: Request, res: Response) => {
  const { maPhieuDat } = req.params as { maPhieuDat: string };
  const { LyDoHoan, TenNganHang, SoTaiKhoan, TenChuTaiKhoan } = req.body as CancelBookingBody;
  const maTaiKhoan = req.user!.maTaiKhoan;

  const bankInfo = TenNganHang && SoTaiKhoan && TenChuTaiKhoan
    ? { TenNganHang, SoTaiKhoan, TenChuTaiKhoan }
    : undefined;

  const result = await datVeService.huyPhieuDatVe(maPhieuDat, LyDoHoan, maTaiKhoan, bankInfo);

  return sendSuccess(res, result.message);
});
