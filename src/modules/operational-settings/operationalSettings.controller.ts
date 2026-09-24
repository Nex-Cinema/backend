import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { getOperationalSettings, updateOperationalSettings } from './operationalSettings.service';
import type { UpdateOperationalSettingsInput } from './operationalSettings.validator';

export const getSettings = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const data = await getOperationalSettings();
  sendSuccess(res, 'Lấy cấu hình vận hành thành công', data);
});

export const updateSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await updateOperationalSettings(req.body as UpdateOperationalSettingsInput);
  sendSuccess(res, 'Cập nhật cấu hình vận hành thành công', data);
});
