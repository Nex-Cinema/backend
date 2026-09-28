import { Request, Response } from 'express';
import * as gdService from './giaodich.service';
import { sendSuccess, sendPaginatedSuccess } from '../../../utils/response';
import { PhieuDatQueryInput, HoanTienInput } from './giaodich.validator';
import { asyncHandler } from '../../../utils/asyncHandler';

export const getDanhSachPhieuDatVe = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as PhieuDatQueryInput;
  const result = await gdService.getDanhSachPhieuDatVe(query);

  return sendPaginatedSuccess(
    res,
    'Lấy danh sách phiếu đặt vé thành công',
    result.items,
    {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  );
});

export const getChiTietPhieuDatVe = asyncHandler(async (req: Request, res: Response) => {
  const { maPhieuDat } = req.params as { maPhieuDat: string };
  const result = await gdService.getChiTietPhieuDatVe(maPhieuDat);

  return sendSuccess(res, 'Lấy chi tiết phiếu đặt vé thành công', result);
});

export const huyPhieuDatVe = asyncHandler(async (req: Request, res: Response) => {
  const { maPhieuDat } = req.params as { maPhieuDat: string };
  const result = await gdService.huyPhieuDatVe(maPhieuDat);

  return sendSuccess(res, 'Hủy phiếu đặt vé thành công', result);
});

export const hoanTienGiaoDich = asyncHandler(async (req: Request, res: Response) => {
  const { maGiaoDich } = req.params as { maGiaoDich: string };
  const input = req.body as HoanTienInput;
  const result = await gdService.hoanTienGiaoDich(maGiaoDich, input);

  return sendSuccess(res, 'Xử lý hoàn tiền giao dịch thành công', result);
});
