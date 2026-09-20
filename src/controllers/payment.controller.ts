import { Request, Response } from 'express';
import * as paymentService from '../services/payment.service';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { BadRequestError } from '../utils/errors';
import { env } from '../config/env';
import { verifyVNPaySignature } from '../utils/vnpay.util';

/**
 * POST /api/v1/payment/payos/create
 * Auth: Customer only
 */
export const createPayosPayment = asyncHandler(async (req: Request, res: Response) => {
  const { MaPhieuDat } = req.body as { MaPhieuDat?: string };
  
  if (!MaPhieuDat) {
    throw new BadRequestError('Mã phiếu đặt (MaPhieuDat) là bắt buộc trong request body.');
  }

  const maTaiKhoan = req.user!.maTaiKhoan;
  const result = await paymentService.createPayosLink(MaPhieuDat, maTaiKhoan);

  return sendSuccess(res, 'Tạo link thanh toán PayOS thành công', result);
});

/**
 * GET /api/v1/payment/payos/:maGiaoDich/status
 * Auth: Customer only
 */
export const getPayosStatus = asyncHandler(async (req: Request, res: Response) => {
  const { maGiaoDich } = req.params as { maGiaoDich?: string };

  if (!maGiaoDich) {
    throw new BadRequestError('Mã giao dịch (maGiaoDich) là bắt buộc trong URL path.');
  }

  const maTaiKhoan = req.user!.maTaiKhoan;
  const result = await paymentService.checkPaymentStatus(maGiaoDich, maTaiKhoan);

  return sendSuccess(res, 'Lấy trạng thái thanh toán thành công', result);
});

/**
 * POST /api/v1/payment/payos/webhook
 * Auth: None (public, PayOS verifies checksum signature)
 */
export const payosWebhook = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.handleWebhook(req.body);

  return res.status(200).json({
    code: '00',
    desc: 'success',
    data: result,
  });
});

/**
 * POST /api/v1/payment/vnpay/create
 * Auth: Customer only
 */
export const createVnpayPayment = asyncHandler(async (req: Request, res: Response) => {
  const { MaPhieuDat } = req.body as { MaPhieuDat?: string };
  
  if (!MaPhieuDat) {
    throw new BadRequestError('Mã phiếu đặt (MaPhieuDat) là bắt buộc trong request body.');
  }

  const maTaiKhoan = req.user!.maTaiKhoan;
  
  // Extract client IP address
  const clientIp = 
    (req.headers['x-forwarded-for'] as string) || 
    req.socket.remoteAddress || 
    '127.0.0.1';

  const finalIp = clientIp.split(',')[0].trim();

  const result = await paymentService.createVnpayLink(MaPhieuDat, maTaiKhoan, finalIp);

  return sendSuccess(res, 'Tạo link thanh toán VNPay thành công', result);
});

/**
 * GET /api/v1/payment/vnpay/return
 * Auth: None (browser redirect from VNPay)
 */
export const vnpayReturn = asyncHandler(async (req: Request, res: Response) => {
  const queryParams = req.query;
  const vnp_TxnRef = queryParams.vnp_TxnRef as string;
  const vnp_ResponseCode = queryParams.vnp_ResponseCode as string;

  const isValidSignature = verifyVNPaySignature(queryParams, env.VNPAY_HASH_SECRET);

  let redirectStatus = 'failed';
  if (isValidSignature && vnp_ResponseCode === '00') {
    redirectStatus = 'success';
  }

  const frontendReturnUrl = env.VNPAY_FRONTEND_RETURN_URL || `${env.FRONTEND_URL}/payment/vnpay-return`;
  const redirectUrl = `${frontendReturnUrl}?maGiaoDich=${vnp_TxnRef || ''}&status=${redirectStatus}`;
  return res.redirect(redirectUrl);
});

/**
 * GET /api/v1/payment/vnpay/ipn
 * Auth: None (IPN webhook)
 */
export const vnpayIpn = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.handleVnpayIpn(req.query);
  return res.status(200).json(result);
});

/**
 * GET /api/v1/payment/vnpay/:maGiaoDich/status
 * Auth: Customer only
 */
export const getVnpayStatus = asyncHandler(async (req: Request, res: Response) => {
  const { maGiaoDich } = req.params as { maGiaoDich?: string };

  if (!maGiaoDich) {
    throw new BadRequestError('Mã giao dịch (maGiaoDich) là bắt buộc trong URL path.');
  }

  const maTaiKhoan = req.user!.maTaiKhoan;
  const result = await paymentService.checkVnpayStatus(maGiaoDich, maTaiKhoan);

  return sendSuccess(res, 'Lấy trạng thái thanh toán VNPay thành công', result);
});
