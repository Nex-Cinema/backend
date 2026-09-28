import { z } from 'zod';
import { SEAT_MAP_LIMITS } from './seatMap.constants';

export const createSoDoGheSchema = z.object({
  TenSoDo: z
    .string({ required_error: 'Tên sơ đồ ghế là bắt buộc' })
    .min(1, 'Tên sơ đồ ghế không được để trống')
    .max(255, 'Tên sơ đồ ghế tối đa 255 ký tự'),
  SoHang: z
    .number({ required_error: 'Số hàng là bắt buộc' })
    .int('Số hàng phải là số nguyên')
    .min(1, 'Số hàng tối thiểu là 1')
    .max(SEAT_MAP_LIMITS.maxRows, `Số hàng tối đa là ${SEAT_MAP_LIMITS.maxRows}`),
  SoCot: z
    .number({ required_error: 'Số cột là bắt buộc' })
    .int('Số cột phải là số nguyên')
    .min(1, 'Số cột tối thiểu là 1')
    .max(SEAT_MAP_LIMITS.maxColumns, `Số cột tối đa là ${SEAT_MAP_LIMITS.maxColumns}`),
  CauTruc: z.string().optional(),
});

export const updateSoDoGheSchema = z.object({
  TenSoDo: z
    .string()
    .min(1, 'Tên sơ đồ ghế không được để trống')
    .max(255, 'Tên sơ đồ ghế tối đa 255 ký tự')
    .optional(),
  SoHang: z
    .number()
    .int('Số hàng phải là số nguyên')
    .min(1, 'Số hàng tối thiểu là 1')
    .max(SEAT_MAP_LIMITS.maxRows, `Số hàng tối đa là ${SEAT_MAP_LIMITS.maxRows}`)
    .optional(),
  SoCot: z
    .number()
    .int('Số cột phải là số nguyên')
    .min(1, 'Số cột tối thiểu là 1')
    .max(SEAT_MAP_LIMITS.maxColumns, `Số cột tối đa là ${SEAT_MAP_LIMITS.maxColumns}`)
    .optional(),
  CauTruc: z.string().optional(),
  KhaDung: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Yêu cầu không được để trống body' }
);

export type CreateSoDoGheInput = z.infer<typeof createSoDoGheSchema>;
export type UpdateSoDoGheInput = z.infer<typeof updateSoDoGheSchema>;
