import { Router } from 'express';
import * as datVeController from './datve.controller';
import { validate } from '../../../middlewares/validate.middleware';
import {
  seatHoldSchema,
  paymentSimulationSchema,
  realPaymentSchema,
  cancelBookingParamSchema,
  cancelBookingBodySchema,
} from './datve.validator';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { requireRoles } from '../../../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

/**
 * @route   POST /api/v1/dat-ve/giu-ghe
 * @desc    Giữ ghế cho khách hàng theo cấu hình vận hành
 * @access  Private - CUSTOMER only
 */
router.post(
  '/giu-ghe',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  validate(seatHoldSchema),
  datVeController.giuGhe,
);

/**
 * @route   POST /api/v1/dat-ve/huy-giu-ghe
 * @desc    Hủy giữ ghế thủ công
 * @access  Private - CUSTOMER only
 */
router.post(
  '/huy-giu-ghe',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  validate(seatHoldSchema),
  datVeController.huyGiuGhe,
);

/**
 * @route   POST /api/v1/dat-ve/thanh-toan-gia-lap
 * @desc    Thanh toán giả lập kết quả đặt vé
 * @access  Private - CUSTOMER only
 */
router.post(
  '/thanh-toan-gia-lap',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  validate(paymentSimulationSchema),
  datVeController.thanhToanGiaLap,
);

/**
 * @route   POST /api/v1/dat-ve/thanh-toan
 * @desc    Thanh toán đặt vé
 * @access  Private - CUSTOMER only
 */
router.post(
  '/thanh-toan',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  validate(realPaymentSchema),
  datVeController.thanhToan,
);

/**
 * @route   POST /api/v1/dat-ve/:maPhieuDat/huy
 * @desc    Khách hàng hủy phiếu đặt vé
 * @access  Private - CUSTOMER only
 */
router.post(
  '/:maPhieuDat/huy',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  validate(cancelBookingParamSchema, 'params'),
  validate(cancelBookingBodySchema, 'body'),
  datVeController.huyDatVe,
);

export default router;
