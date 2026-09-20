import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';
import { Role } from '@prisma/client';
import { getPublicSettings } from '../controllers/paymentGateway.controller';

const router = Router();

router.get('/gateways', getPublicSettings);

/**
 * @route   POST /api/v1/payment/payos/create
 * @desc    Tạo link thanh toán PayOS cho phiếu đặt vé
 * @access  Private - CUSTOMER only
 */
router.post(
  '/payos/create',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  paymentController.createPayosPayment,
);

/**
 * @route   GET /api/v1/payment/payos/:maGiaoDich/status
 * @desc    Kiểm tra trạng thái thanh toán PayOS và đồng bộ
 * @access  Private - CUSTOMER only (owner check enforced in service)
 */
router.get(
  '/payos/:maGiaoDich/status',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  paymentController.getPayosStatus,
);

/**
 * @route   POST /api/v1/payment/payos/webhook
 * @desc    Nhận cập nhật thanh toán từ PayOS
 * @access  Public (Signature verification checks integrity)
 */
router.post(
  '/payos/webhook',
  paymentController.payosWebhook,
);

/**
 * @route   POST /api/v1/payment/vnpay/create
 * @desc    Tạo link thanh toán VNPay cho phiếu đặt vé
 * @access  Private - CUSTOMER only
 */
router.post(
  '/vnpay/create',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  paymentController.createVnpayPayment,
);

/**
 * @route   GET /api/v1/payment/vnpay/return
 * @desc    VNPay redirect sau khi thanh toán xong
 * @access  Public
 */
router.get(
  '/vnpay/return',
  paymentController.vnpayReturn,
);

/**
 * @route   GET /api/v1/payment/vnpay/ipn
 * @desc    IPN webhook từ VNPay để cập nhật trạng thái thanh toán
 * @access  Public (Signature verification checks integrity)
 */
router.get(
  '/vnpay/ipn',
  paymentController.vnpayIpn,
);

/**
 * @route   GET /api/v1/payment/vnpay/:maGiaoDich/status
 * @desc    Kiểm tra trạng thái thanh toán VNPay trong hệ thống
 * @access  Private - CUSTOMER only
 */
router.get(
  '/vnpay/:maGiaoDich/status',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  paymentController.getVnpayStatus,
);

export default router;
