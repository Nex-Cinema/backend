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
 * @desc    Tạo URL thanh toán VNPay Sandbox cho phiếu đặt vé
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
 * @desc    Nhận browser redirect từ VNPay rồi chuyển về frontend
 * @access  Public (signature verification)
 */
router.get('/vnpay/return', paymentController.vnpayReturn);

/**
 * @route   GET /api/v1/payment/vnpay/ipn
 * @desc    Nhận IPN server-to-server từ VNPay
 * @access  Public (signature verification)
 */
router.get('/vnpay/ipn', paymentController.vnpayIpn);

/**
 * @route   GET /api/v1/payment/vnpay/:maGiaoDich/status
 * @desc    Kiểm tra trạng thái giao dịch VNPay trong hệ thống
 * @access  Private - CUSTOMER owner only
 */
router.get(
  '/vnpay/:maGiaoDich/status',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  paymentController.getVnpayStatus,
);

export default router;
