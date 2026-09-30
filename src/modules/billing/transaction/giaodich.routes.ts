import { Router } from 'express';
import * as controller from './giaodich.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { phieuDatQuerySchema, hoanTienSchema } from './giaodich.validator';

const router = Router();

/**
 * @route   GET /api/v1/admin/giao-dich/phieu-dat
 * @desc    Lấy danh sách phiếu đặt vé (phân trang, lọc, tìm kiếm)
 * @access  Private - ADMIN only
 */
router.get(
  '/phieu-dat',
  validate(phieuDatQuerySchema, 'query'),
  controller.getDanhSachPhieuDatVe,
);

/**
 * @route   GET /api/v1/admin/giao-dich/phieu-dat/:maPhieuDat
 * @desc    Xem chi tiết phiếu đặt vé và các giao dịch đi kèm
 * @access  Private - ADMIN only
 */
router.get('/phieu-dat/:maPhieuDat', controller.getChiTietPhieuDatVe);

/**
 * @route   PATCH /api/v1/admin/giao-dich/phieu-dat/:maPhieuDat/huy
 * @desc    Hủy phiếu đặt vé và giải phóng ghế
 * @access  Private - ADMIN only
 */
router.patch('/phieu-dat/:maPhieuDat/huy', controller.huyPhieuDatVe);

/**
 * @route   POST /api/v1/admin/giao-dich/:maGiaoDich/hoan-tien
 * @desc    Hoàn tiền giao dịch thành công (hủy vé + giải phóng ghế kèm theo)
 * @access  Private - ADMIN only
 */
router.post(
  '/:maGiaoDich/hoan-tien',
  validate(hoanTienSchema),
  controller.hoanTienGiaoDich,
);

export default router;
