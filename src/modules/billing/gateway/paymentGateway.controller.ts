import { Request, Response } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler';
import { sendSuccess } from '../../../utils/response';
import * as paymentGatewayService from './paymentGateway.service';

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const result = await paymentGatewayService.getPaymentGatewaySettings();
  return sendSuccess(res, 'Lấy trạng thái cổng thanh toán thành công', result);
});

export const getPublicSettings = asyncHandler(async (_req: Request, res: Response) => {
  const result = await paymentGatewayService.getPublicPaymentGateways();
  return sendSuccess(res, 'Lấy phương thức thanh toán khả dụng thành công', result);
});

export const updateSetting = asyncHandler(async (req: Request, res: Response) => {
  const provider = req.params.provider as paymentGatewayService.PaymentProvider;
  const result = await paymentGatewayService.updatePaymentGatewaySetting(provider, req.body.enabled);
  return sendSuccess(res, `Đã ${req.body.enabled ? 'bật' : 'tắt'} cổng ${provider}`, result);
});
