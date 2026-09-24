import { Request, Response, NextFunction } from 'express';
import * as staffBanVeService from './staffBanVe.service';
import { sendSuccess, sendPaginatedSuccess } from '../../../utils/response';
import { StaffShowtimeQueryInput, StaffSellTicketInput } from './staffBanVe.validator';

/**
 * GET /api/v1/staff/ban-ve/suat-chieu
 * Lấy danh sách suất chiếu khả dụng tại quầy cho nhân viên
 */
export const getDanhSachSuatChieu = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const maTaiKhoan = req.user!.maTaiKhoan;
    const query = req.query as any as StaffShowtimeQueryInput;

    const result = await staffBanVeService.getShowtimesForStaff(maTaiKhoan, {
      keyword: query.keyword,
      ngayChieu: query.ngayChieu,
      maPhim: query.maPhim,
      maPhong: query.maPhong,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    });

    sendPaginatedSuccess(
      res,
      'Lấy danh sách suất chiếu thành công',
      result.showtimes,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/staff/ban-ve/suat-chieu/:maSuatChieu/ghe
 * Lấy sơ đồ ghế và trạng thái đặt vé cho nhân viên
 */
export const getSeatMapSuatChieu = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const maTaiKhoan = req.user!.maTaiKhoan;
    const maSuatChieu = req.params.maSuatChieu as string;

    const seatMap = await staffBanVeService.getSeatMapForStaff(maTaiKhoan, maSuatChieu);

    sendSuccess(res, 'Lấy sơ đồ ghế thành công', seatMap);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/staff/ban-ve/thanh-toan
 * Thanh toán vé tại quầy cho nhân viên
 */
export const thanhToanBanVe = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const maTaiKhoan = req.user!.maTaiKhoan;
    const body = req.body as StaffSellTicketInput;

    const result = await staffBanVeService.sellTicketsAtCounter(maTaiKhoan, body);

    sendSuccess(res, 'Thanh toán vé tại quầy thành công', result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/staff/ban-ve/lich-su
 * Lấy lịch sử bán vé tại quầy của nhân viên
 */
export const getLichSuBanVe = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const maTaiKhoan = req.user!.maTaiKhoan;
    const query = req.query as any;

    const result = await staffBanVeService.getSalesHistoryForStaff(maTaiKhoan, {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      tuNgay: query.tuNgay,
      denNgay: query.denNgay,
      keyword: query.keyword,
    });

    sendPaginatedSuccess(
      res,
      'Lấy lịch sử bán vé thành công',
      result.history,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      }
    );
  } catch (error) {
    next(error);
  }
};
