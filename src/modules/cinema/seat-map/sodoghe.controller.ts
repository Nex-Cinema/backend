import { Request, Response } from 'express';
import * as sodogheService from './sodoghe.service';
import { sendSuccess, sendCreated } from '../../../utils/response';
import { CreateSoDoGheInput, UpdateSoDoGheInput } from './sodoghe.validator';
import { asyncHandler } from '../../../utils/asyncHandler';

export const getSoDoGhes = asyncHandler(async (req: Request, res: Response) => {
  const result = await sodogheService.getSoDoGhes();
  return sendSuccess(res, 'Lấy danh sách sơ đồ ghế mẫu thành công', result);
});

export const getSoDoGheById = asyncHandler(async (req: Request, res: Response) => {
  const { maSoDo } = req.params as { maSoDo: string };
  const result = await sodogheService.getSoDoGheById(maSoDo);
  return sendSuccess(res, 'Lấy thông tin sơ đồ ghế mẫu thành công', result);
});

export const taoSoDoGhe = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateSoDoGheInput;
  const result = await sodogheService.taoSoDoGhe(input);
  return sendCreated(res, 'Tạo sơ đồ ghế mẫu thành công', result);
});

export const capNhatSoDoGhe = asyncHandler(async (req: Request, res: Response) => {
  const { maSoDo } = req.params as { maSoDo: string };
  const input = req.body as UpdateSoDoGheInput;
  const result = await sodogheService.capNhatSoDoGhe(maSoDo, input);
  return sendSuccess(res, 'Cập nhật sơ đồ ghế mẫu thành công', result);
});

export const xoaSoDoGhe = asyncHandler(async (req: Request, res: Response) => {
  const { maSoDo } = req.params as { maSoDo: string };
  const { action, data } = await sodogheService.xoaSoDoGhe(maSoDo);

  const msg =
    action === 'soft'
      ? 'Sơ đồ ghế mẫu đang được sử dụng nên đã ẩn trạng thái khả dụng'
      : 'Xóa sơ đồ ghế mẫu vĩnh viễn thành công';

  return sendSuccess(res, msg, data);
});
