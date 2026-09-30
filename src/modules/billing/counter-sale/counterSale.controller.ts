import { Request, Response } from 'express';
import { createCounterSale, type CounterSaleInput } from '../../booking';
import { asyncHandler } from '../../../utils/asyncHandler';
import { sendSuccess } from '../../../utils/response';
import { assertPaymentGatewayAvailable } from '../gateway/paymentGateway.service';
import { checkCounterPayosStatus, createCounterPayosLink } from '../payment/payment.service';

export const sellAtCounter = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CounterSaleInput;
  const adminAccountId = req.user!.maTaiKhoan;

  if (input.PhuongThucThanhToan === 'PAYOS') {
    await assertPaymentGatewayAvailable('PAYOS');
  }

  const booking = await createCounterSale(input, adminAccountId);
  if (input.PhuongThucThanhToan === 'PAYOS') {
    const payment = await createCounterPayosLink(booking.MaPhieuDat, adminAccountId);
    return sendSuccess(res, 'Đã tạo mã QR chuyển khoản tại quầy', { ...booking, payment });
  }

  return sendSuccess(res, 'Bán vé tiền mặt thành công', booking);
});

export const recreateCounterPayosLink = asyncHandler(async (req: Request, res: Response) => {
  const payment = await createCounterPayosLink(req.params.maPhieuDat as string, req.user!.maTaiKhoan);
  return sendSuccess(res, 'Đã tạo lại mã QR chuyển khoản tại quầy', payment);
});

export const getCounterPayosStatus = asyncHandler(async (req: Request, res: Response) => {
  const status = await checkCounterPayosStatus(req.params.maGiaoDich as string);
  return sendSuccess(res, 'Đã kiểm tra trạng thái chuyển khoản tại quầy', status);
});
