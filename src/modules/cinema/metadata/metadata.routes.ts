import { Router } from 'express';
import * as controller from './metadata.controller';
import { validate } from '../../../middlewares/validate.middleware';
import {
  createLoaiPhongSchema,
  updateLoaiPhongSchema,
  createLoaiGheSchema,
  updateLoaiGheSchema,
  createLoaiNgaySchema,
  updateLoaiNgaySchema,
} from './metadata.validator';

const router = Router();

// ==========================================
// 1. LOẠI PHÒNG (Room Type)
// ==========================================
router.get('/loai-phong', controller.getLoaiPhongs);
router.get('/loai-phong/:maLoaiPhong', controller.getLoaiPhongById);
router.post('/loai-phong', validate(createLoaiPhongSchema), controller.taoLoaiPhong);
router.put('/loai-phong/:maLoaiPhong', validate(updateLoaiPhongSchema), controller.capNhatLoaiPhong);
router.delete('/loai-phong/:maLoaiPhong', controller.xoaLoaiPhong);

// ==========================================
// 2. LOẠI GHẾ (Seat Type)
// ==========================================
router.get('/loai-ghe', controller.getLoaiGhes);
router.get('/loai-ghe/:maLoaiGhe', controller.getLoaiGheById);
router.post('/loai-ghe', validate(createLoaiGheSchema), controller.taoLoaiGhe);
router.put('/loai-ghe/:maLoaiGhe', validate(updateLoaiGheSchema), controller.capNhatLoaiGhe);
router.delete('/loai-ghe/:maLoaiGhe', controller.xoaLoaiGhe);

// ==========================================
// 3. LOẠI NGÀY (Day Type)
// ==========================================
router.get('/loai-ngay', controller.getLoaiNgays);
router.get('/loai-ngay/:maLoaiNgay', controller.getLoaiNgayById);
router.post('/loai-ngay', validate(createLoaiNgaySchema), controller.taoLoaiNgay);
router.put('/loai-ngay/:maLoaiNgay', validate(updateLoaiNgaySchema), controller.capNhatLoaiNgay);
router.delete('/loai-ngay/:maLoaiNgay', controller.xoaLoaiNgay);

export default router;
