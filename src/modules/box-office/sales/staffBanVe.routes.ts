import { Router } from 'express';
import { Role } from '@prisma/client';
import * as staffBanVeController from './staffBanVe.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { requireRoles } from '../../../middlewares/role.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { staffShowtimeQuerySchema, maSuatChieuParamSchema, staffSellTicketSchema } from './staffBanVe.validator';
import { historyQuerySchema } from '../../../shared/historyQuery';

const router = Router();

/**
 * @route   GET /api/v1/staff/ban-ve/suat-chieu
 * @desc    Lấy danh sách suất chiếu khả dụng tại quầy cho nhân viên
 * @access  Private (STAFF only)
 */
router.get(
  '/staff/ban-ve/suat-chieu',
  authMiddleware,
  requireRoles(Role.STAFF),
  validate(staffShowtimeQuerySchema, 'query'),
  staffBanVeController.getDanhSachSuatChieu,
);

/**
 * @route   GET /api/v1/staff/ban-ve/suat-chieu/:maSuatChieu/ghe
 * @desc    Lấy sơ đồ ghế và trạng thái đặt vé cho nhân viên
 * @access  Private (STAFF only)
 */
router.get(
  '/staff/ban-ve/suat-chieu/:maSuatChieu/ghe',
  authMiddleware,
  requireRoles(Role.STAFF),
  validate(maSuatChieuParamSchema, 'params'),
  staffBanVeController.getSeatMapSuatChieu,
);

/**
 * @route   POST /api/v1/staff/ban-ve/thanh-toan
 * @desc    Thanh toán vé tại quầy cho nhân viên
 * @access  Private (STAFF only)
 */
router.post(
  '/staff/ban-ve/thanh-toan',
  authMiddleware,
  requireRoles(Role.STAFF),
  validate(staffSellTicketSchema, 'body'),
  staffBanVeController.thanhToanBanVe,
);

/**
 * @route   GET /api/v1/staff/ban-ve/lich-su
 * @desc    Lấy lịch sử bán vé tại quầy của nhân viên
 * @access  Private (STAFF only)
 */
router.get(
  '/staff/ban-ve/lich-su',
  authMiddleware,
  requireRoles(Role.STAFF),
  validate(historyQuerySchema, 'query'),
  staffBanVeController.getLichSuBanVe,
);

export default router;
