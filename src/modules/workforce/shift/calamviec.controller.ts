import { Request, Response } from 'express';
import * as caService from './calamviec.service';
import { sendSuccess, sendCreated } from '../../../utils/response';
import {
  CreateCaLamViecInput,
  UpdateCaLamViecInput,
  PhanCaInput,
  LichTrucQueryInput,
} from './calamviec.validator';
import { asyncHandler } from '../../../utils/asyncHandler';

export const createCaLamViec = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateCaLamViecInput;
  const result = await caService.createCaLamViec(input);

  return sendCreated(res, 'Tạo ca làm việc mẫu thành công', result);
});

export const getDanhSachCaLamViec = asyncHandler(async (req: Request, res: Response) => {
  const result = await caService.getDanhSachCaLamViec();

  return sendSuccess(res, 'Lấy danh sách ca làm việc mẫu thành công', result);
});

export const getChiTietCaLamViec = asyncHandler(async (req: Request, res: Response) => {
  const { maCa } = req.params as { maCa: string };
  const result = await caService.getChiTietCaLamViec(maCa);

  return sendSuccess(res, 'Lấy chi tiết ca làm việc mẫu thành công', result);
});

export const updateCaLamViec = asyncHandler(async (req: Request, res: Response) => {
  const { maCa } = req.params as { maCa: string };
  const input = req.body as UpdateCaLamViecInput;
  const result = await caService.updateCaLamViec(maCa, input);

  return sendSuccess(res, 'Cập nhật ca làm việc mẫu thành công', result);
});

export const deleteCaLamViec = asyncHandler(async (req: Request, res: Response) => {
  const { maCa } = req.params as { maCa: string };
  const { action, data } = await caService.deleteCaLamViec(maCa);

  const msg =
    action === 'soft'
      ? 'Ca làm việc mẫu đang được phân ca trực nên chỉ ẩn trạng thái khả dụng'
      : 'Xóa ca làm việc mẫu vĩnh viễn thành công';

  return sendSuccess(res, msg, data);
});

export const phanCaLamViec = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as PhanCaInput;
  const result = await caService.phanCaLamViec(input);

  return sendCreated(res, 'Phân công ca trực cho nhân viên thành công', result);
});

export const getLichTruc = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as LichTrucQueryInput;
  const result = await caService.getLichTruc(query);

  return sendSuccess(res, 'Lấy danh sách lịch trực thành công', result);
});

export const huyPhanCa = asyncHandler(async (req: Request, res: Response) => {
  const { maChiTietCa } = req.params as { maChiTietCa: string };
  await caService.huyPhanCa(maChiTietCa);

  return sendSuccess(res, 'Hủy phân công ca trực thành công');
});

export const togglePhanCaStatus = asyncHandler(async (req: Request, res: Response) => {
  const { maChiTietCa } = req.params as { maChiTietCa: string };
  const result = await caService.togglePhanCaStatus(maChiTietCa);

  return sendSuccess(res, 'Cập nhật trạng thái phân ca thành công', result);
});
