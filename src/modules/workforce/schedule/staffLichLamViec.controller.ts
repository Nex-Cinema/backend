import { Request, Response } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler';
import { sendSuccess, sendPaginatedSuccess } from '../../../utils/response';
import * as staffLichLamViecService from './staffLichLamViec.service';
import {
  ShiftTemplateQueryInput,
  MyScheduleQueryInput,
  RegisterShiftInput,
} from './staffLichLamViec.validator';

/**
 * GET /api/v1/staff/lich-lam-viec/ca-lam
 * Staff views available shift templates and availability by date
 */
export const getCaLam = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const maTaiKhoan = req.user!.maTaiKhoan;
  const query = req.query as any as ShiftTemplateQueryInput;

  const result = await staffLichLamViecService.getAvailableShifts(maTaiKhoan, query);

  sendPaginatedSuccess(
    res,
    'Lấy danh sách ca làm việc thành công',
    result.shifts,
    {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    }
  );
});

/**
 * GET /api/v1/staff/lich-lam-viec/cua-toi
 * Staff views their own registered work schedule
 */
export const getLichCuaToi = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const maTaiKhoan = req.user!.maTaiKhoan;
  const query = req.query as any as MyScheduleQueryInput;

  const result = await staffLichLamViecService.getMySchedule(maTaiKhoan, query);

  sendPaginatedSuccess(
    res,
    'Lấy lịch làm việc của tôi thành công',
    result.schedules,
    {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    }
  );
});

/**
 * POST /api/v1/staff/lich-lam-viec/dang-ky
 * Staff registers for a shift on a specific date
 */
export const dangKyCa = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const maTaiKhoan = req.user!.maTaiKhoan;
  const body = req.body as RegisterShiftInput;

  const result = await staffLichLamViecService.registerShift(maTaiKhoan, body);

  sendSuccess(res, 'Đăng ký ca làm thành công', result);
});

/**
 * PATCH /api/v1/staff/lich-lam-viec/:maChiTietCa/huy
 * Staff cancels their own registered shift (soft-delete)
 */
export const huyCa = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const maTaiKhoan = req.user!.maTaiKhoan;
  const { maChiTietCa } = req.params as { maChiTietCa: string };

  await staffLichLamViecService.cancelShift(maTaiKhoan, maChiTietCa);

  sendSuccess(res, 'Hủy ca làm thành công');
});
