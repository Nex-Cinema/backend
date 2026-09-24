import { Router } from 'express';
import * as controller from './phongchieu.controller';
import { validate } from '../../../middlewares/validate.middleware';
import {
  createPhongChieuSchema,
  updatePhongChieuSchema,
  updateGhesSchema,
} from './phongchieu.validator';

const router = Router();

// ==========================================
// 1. PHÒNG CHIẾU (Screening Room) ROUTES
// ==========================================
router.get('/', controller.getDanhSachPhongChieu);
router.get('/:maPhong', controller.getChiTietPhongChieu);
router.post('/', validate(createPhongChieuSchema), controller.taoPhongChieu);
router.put('/:maPhong', validate(updatePhongChieuSchema), controller.capNhatPhongChieu);
router.delete('/:maPhong', controller.xoaPhongChieu);

// ==========================================
// 2. CẤU HÌNH GHẾ (Seat Layout) ROUTES
// ==========================================
router.get('/:maPhong/ghe', controller.getDanhSachGhe);
router.put('/:maPhong/ghe', validate(updateGhesSchema), controller.capNhatCauHinhGhe);

export default router;
