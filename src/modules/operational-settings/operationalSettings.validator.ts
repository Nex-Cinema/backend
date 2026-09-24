import { z } from 'zod';
import { OPERATIONAL_SETTING_LIMITS } from './operationalSettings.constants';

const integerInRange = (field: keyof typeof OPERATIONAL_SETTING_LIMITS) => {
  const limits = OPERATIONAL_SETTING_LIMITS[field];
  return z.number().int().min(limits.min).max(limits.max);
};

export const updateOperationalSettingsSchema = z
  .object({
    ThoiGianGiuGhePhut: integerInRange('ThoiGianGiuGhePhut').optional(),
    CuaSoCheckInPhut: integerInRange('CuaSoCheckInPhut').optional(),
    HanHuyCaTruocGio: integerInRange('HanHuyCaTruocGio').optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Cần cung cấp ít nhất một cấu hình để cập nhật',
  });

export type UpdateOperationalSettingsInput = z.infer<typeof updateOperationalSettingsSchema>;
