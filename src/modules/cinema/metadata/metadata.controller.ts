import { Request, Response } from 'express';
import * as metadataService from './metadata.service';
import { sendSuccess, sendCreated } from '../../../utils/response';
import {
  CreateLoaiPhongInput,
  UpdateLoaiPhongInput,
  CreateLoaiGheInput,
  UpdateLoaiGheInput,
  CreateLoaiNgayInput,
  UpdateLoaiNgayInput,
} from './metadata.validator';
import { asyncHandler } from '../../../utils/asyncHandler';

// ==========================================
// 1. LOẠI PHÒNG CONTROLLERS
// ==========================================

export const getLoaiPhongs = asyncHandler(async (req: Request, res: Response) => {
  const result = await metadataService.getLoaiPhongs();
  return sendSuccess(res, 'Lấy danh sách loại phòng thành công', result);
});

export const getLoaiPhongById = asyncHandler(async (req: Request, res: Response) => {
  const { maLoaiPhong } = req.params as { maLoaiPhong: string };
  const result = await metadataService.getLoaiPhongById(maLoaiPhong);
  return sendSuccess(res, 'Lấy thông tin loại phòng thành công', result);
});

export const taoLoaiPhong = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateLoaiPhongInput;
  const result = await metadataService.taoLoaiPhong(input);
  return sendCreated(res, 'Tạo loại phòng thành công', result);
});

export const capNhatLoaiPhong = asyncHandler(async (req: Request, res: Response) => {
  const { maLoaiPhong } = req.params as { maLoaiPhong: string };
  const input = req.body as UpdateLoaiPhongInput;
  const result = await metadataService.capNhatLoaiPhong(maLoaiPhong, input);
  return sendSuccess(res, 'Cập nhật loại phòng thành công', result);
});

export const xoaLoaiPhong = asyncHandler(async (req: Request, res: Response) => {
  const { maLoaiPhong } = req.params as { maLoaiPhong: string };
  const { action, data } = await metadataService.xoaLoaiPhong(maLoaiPhong);
  
  const msg = action === 'soft'
    ? 'Loại phòng đang được sử dụng nên đã ẩn trạng thái khả dụng'
    : 'Xóa loại phòng vĩnh viễn thành công';
    
  return sendSuccess(res, msg, data);
});

// ==========================================
// 2. LOẠI GHẾ CONTROLLERS
// ==========================================

export const getLoaiGhes = asyncHandler(async (req: Request, res: Response) => {
  const result = await metadataService.getLoaiGhes();
  return sendSuccess(res, 'Lấy danh sách loại ghế thành công', result);
});

export const getLoaiGheById = asyncHandler(async (req: Request, res: Response) => {
  const { maLoaiGhe } = req.params as { maLoaiGhe: string };
  const result = await metadataService.getLoaiGheById(maLoaiGhe);
  return sendSuccess(res, 'Lấy thông tin loại ghế thành công', result);
});

export const taoLoaiGhe = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateLoaiGheInput;
  const result = await metadataService.taoLoaiGhe(input);
  return sendCreated(res, 'Tạo loại ghế thành công', result);
});

export const capNhatLoaiGhe = asyncHandler(async (req: Request, res: Response) => {
  const { maLoaiGhe } = req.params as { maLoaiGhe: string };
  const input = req.body as UpdateLoaiGheInput;
  const result = await metadataService.capNhatLoaiGhe(maLoaiGhe, input);
  return sendSuccess(res, 'Cập nhật loại ghế thành công', result);
});

export const xoaLoaiGhe = asyncHandler(async (req: Request, res: Response) => {
  const { maLoaiGhe } = req.params as { maLoaiGhe: string };
  const { action, data } = await metadataService.xoaLoaiGhe(maLoaiGhe);
  
  const msg = action === 'soft'
    ? 'Loại ghế đang được sử dụng nên đã ẩn trạng thái khả dụng'
    : 'Xóa loại ghế vĩnh viễn thành công';
    
  return sendSuccess(res, msg, data);
});

// ==========================================
// 3. LOẠI NGÀY CONTROLLERS
// ==========================================

export const getLoaiNgays = asyncHandler(async (req: Request, res: Response) => {
  const result = await metadataService.getLoaiNgays();
  return sendSuccess(res, 'Lấy danh sách loại ngày thành công', result);
});

export const getLoaiNgayById = asyncHandler(async (req: Request, res: Response) => {
  const { maLoaiNgay } = req.params as { maLoaiNgay: string };
  const result = await metadataService.getLoaiNgayById(maLoaiNgay);
  return sendSuccess(res, 'Lấy thông tin loại ngày thành công', result);
});

export const taoLoaiNgay = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateLoaiNgayInput;
  const result = await metadataService.taoLoaiNgay(input);
  return sendCreated(res, 'Tạo loại ngày thành công', result);
});

export const capNhatLoaiNgay = asyncHandler(async (req: Request, res: Response) => {
  const { maLoaiNgay } = req.params as { maLoaiNgay: string };
  const input = req.body as UpdateLoaiNgayInput;
  const result = await metadataService.capNhatLoaiNgay(maLoaiNgay, input);
  return sendSuccess(res, 'Cập nhật loại ngày thành công', result);
});

export const xoaLoaiNgay = asyncHandler(async (req: Request, res: Response) => {
  const { maLoaiNgay } = req.params as { maLoaiNgay: string };
  const { action, data } = await metadataService.xoaLoaiNgay(maLoaiNgay);
  
  const msg = action === 'soft'
    ? 'Loại ngày đang được sử dụng nên đã ẩn trạng thái khả dụng'
    : 'Xóa loại ngày vĩnh viễn thành công';
    
  return sendSuccess(res, msg, data);
});
