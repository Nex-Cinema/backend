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

  const forwardedIp = req.headers['x-forwarded-for'];
  const clientIp = (Array.isArray(forwardedIp) ? forwardedIp[0] : forwardedIp)
    || req.socket.remoteAddress
    || '127.0.0.1';
  const result = await paymentService.createVnpayLink(
    MaPhieuDat,
    req.user!.maTaiKhoan,
    clientIp,
  );

  return sendSuccess(res, 'Tạo URL thanh toán VNPay Sandbox thành công', result);
});

/**
 * GET /api/v1/payment/vnpay/return
 * Auth: None (browser redirect)
 *
 * Production keeps IPN as the source of truth. Local sandbox development may
 * explicitly enable signed-return confirmation because VNPay cannot call a
 * localhost IPN URL. The same signature, amount and idempotency checks used by
 * the IPN handler still apply.
 */
export const vnpayReturn = asyncHandler(async (req: Request, res: Response) => {
  const queryParams = req.query as Record<string, unknown>;
  const transactionReference = typeof queryParams.vnp_TxnRef === 'string'
    ? queryParams.vnp_TxnRef
    : '';
  const responseCode = typeof queryParams.vnp_ResponseCode === 'string'
    ? queryParams.vnp_ResponseCode
    : '';
  const signatureValid = verifyVNPaySignature(queryParams, env.VNPAY_HASH_SECRET);
  let returnStatus = signatureValid && responseCode === '00' ? 'processing' : 'failed';

  if (signatureValid && env.VNPAY_ALLOW_SIGNED_RETURN_CONFIRMATION) {
    const confirmation = await paymentService.handleVnpayIpn(queryParams);
    returnStatus = confirmation.RspCode === '00' ? 'success' : 'failed';
  }

  const frontendReturnUrl = env.VNPAY_FRONTEND_RETURN_URL
    || `${env.FRONTEND_URL}/payment/vnpay-return`;
  const redirectUrl = new URL(frontendReturnUrl);
  redirectUrl.searchParams.set('maGiaoDich', transactionReference);
  redirectUrl.searchParams.set('status', returnStatus);

  return res.redirect(redirectUrl.toString());
});

/**
 * GET /api/v1/payment/vnpay/ipn
 * Auth: None (VNPay signature verified in service)
 */
export const vnpayIpn = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.handleVnpayIpn(req.query as Record<string, unknown>);
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

  const result = await paymentService.checkVnpayStatus(maGiaoDich, req.user!.maTaiKhoan);
  return sendSuccess(res, 'Lấy trạng thái thanh toán VNPay thành công', result);
});
