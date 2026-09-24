import { Router } from 'express';
import * as lichSuController from './lichsu.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { bookingHistoryQuerySchema, maPhieuDatParamSchema } from './lichsu.validator';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { requireRoles } from '../../../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

/**
 * @route   GET /api/v1/lich-su-giao-dich
 * @desc    Xem lịch sử đặt vé của khách hàng
 * @access  Private - CUSTOMER only
 */
router.get(
  '/',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  validate(bookingHistoryQuerySchema, 'query'),
  lichSuController.getLichSuGiaoDich,
);

/**
 * @route   GET /api/v1/lich-su-giao-dich/:maPhieuDat
 * @desc    Xem chi tiết phiếu đặt vé
 * @access  Private - CUSTOMER only
 */
router.get(
  '/:maPhieuDat',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  validate(maPhieuDatParamSchema, 'params'),
  lichSuController.getChiTietLichSu,
);

export default router;
