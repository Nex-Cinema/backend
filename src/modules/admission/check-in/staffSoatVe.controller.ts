import { Request, Response } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler';
import { sendSuccess, sendPaginatedSuccess } from '../../../utils/response';
import * as staffSoatVeService from './staffSoatVe.service';
import { ValidateTicketInput, CheckInInput, HistoryQueryInput } from './staffSoatVe.validator';

/**
 * POST /api/v1/staff/soat-ve/kiem-tra
 * Validate ticket before actual check-in
 */
export const kiemTraVe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const maTaiKhoan = req.user!.maTaiKhoan;
  const body = req.body as ValidateTicketInput;

  const result = await staffSoatVeService.validateTicket(maTaiKhoan, body);

  sendSuccess(res, 'Kiểm tra vé thành công', result);
});

/**
 * POST /api/v1/staff/soat-ve/check-in
 * Mark a ticket as checked in
 */
export const checkInVe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const maTaiKhoan = req.user!.maTaiKhoan;
  const body = req.body as CheckInInput;

  const result = await staffSoatVeService.checkInTicket(maTaiKhoan, body);

  sendSuccess(res, 'Check-in vé thành công', result);
});

/**
 * GET /api/v1/staff/soat-ve/lich-su
 * View recent ticket check-in logs history
 */
export const getLichSuSoatVe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const maTaiKhoan = req.user!.maTaiKhoan;
  const query = req.query as any as HistoryQueryInput;

  const result = await staffSoatVeService.getCheckInHistoryLogs(maTaiKhoan, {
    page: query.page ?? 1,
    limit: query.limit ?? 10,
    tuNgay: query.tuNgay,
    denNgay: query.denNgay,
    keyword: query.keyword,
  });

  sendPaginatedSuccess(
    res,
    'Lấy lịch sử soát vé thành công',
    result.history,
    {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    }
  );
});
