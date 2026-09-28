import { Request, Response } from 'express';
import * as hoanTienService from './hoantien.service';
import { sendSuccess, sendPaginatedSuccess } from '../../../utils/response';
import { asyncHandler } from '../../../utils/asyncHandler';
import {
  RefundRequestInput,
  RefundListQueryInput,
  AdminRefundQueryInput,
} from './hoantien.validator';

/**
 * POST /api/v1/hoan-tien/yeu-cau
 */
export const yeuCauHoanTien = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as RefundRequestInput;
  const maTaiKhoan = req.user!.maTaiKhoan;

  const result = await hoanTienService.yeuCauHoanTien(maTaiKhoan, input);

  return sendSuccess(res, 'Gửi yêu cầu hoàn tiền thành công', result);
});

/**
 * GET /api/v1/hoan-tien/cua-toi
 */
export const getHoanTienCuaToi = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as RefundListQueryInput;
  const maTaiKhoan = req.user!.maTaiKhoan;

  const result = await hoanTienService.getHoanTienCuaToi(maTaiKhoan, query);

  return res.status(200).json({
    success: true,
    message: 'Lấy danh sách yêu cầu hoàn tiền thành công',
    data: result.items,
    pagination: result.pagination,
  });
});

/**
 * GET /api/v1/admin/hoan-tien
 */
export const getRefundRequestsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as AdminRefundQueryInput;
  const result = await hoanTienService.getRefundRequestsAdmin(query);

  return sendPaginatedSuccess(
    res,
    'Lấy danh sách yêu cầu hoàn tiền thành công',
    result.items,
    {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  );
});

/**
 * GET /api/v1/admin/hoan-tien/:maHoanTien
 */
export const getRefundRequestByIdAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { maHoanTien } = req.params as { maHoanTien: string };
  const result = await hoanTienService.getRefundRequestByIdAdmin(maHoanTien);

  return sendSuccess(res, 'Lấy chi tiết yêu cầu hoàn tiền thành công', result);
});

/**
 * PATCH /api/v1/admin/hoan-tien/:maHoanTien/duyet
 */
export const approveRefundRequestAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { maHoanTien } = req.params as { maHoanTien: string };
  const result = await hoanTienService.approveRefundRequestAdmin(maHoanTien);

  return sendSuccess(res, 'Duyệt yêu cầu hoàn tiền thành công', result);
});

/**
 * PATCH /api/v1/admin/hoan-tien/:maHoanTien/tu-choi
 */
export const rejectRefundRequestAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { maHoanTien } = req.params as { maHoanTien: string };
  const result = await hoanTienService.rejectRefundRequestAdmin(maHoanTien);

  return sendSuccess(res, 'Từ chối yêu cầu hoàn tiền thành công', result);
});
