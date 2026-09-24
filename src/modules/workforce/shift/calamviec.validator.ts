import { z } from 'zod';

const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

export const createCaLamViecSchema = z.object({
  TenCa: z
    .string({ required_error: 'Tên ca làm việc là bắt buộc' })
    .min(1, 'Tên ca không được để trống')
    .max(100, 'Tên ca tối đa 100 ký tự'),
  GioBatDau: z
    .string({ required_error: 'Giờ bắt đầu là bắt buộc' })
    .regex(timeRegex, 'Giờ bắt đầu phải ở định dạng HH:mm:ss (ví dụ: 08:00:00)'),
  GioKetThuc: z
    .string({ required_error: 'Giờ kết thúc là bắt buộc' })
    .regex(timeRegex, 'Giờ kết thúc phải ở định dạng HH:mm:ss (ví dụ: 12:00:00)'),
  SoNguoiToiDa: z
    .coerce
    .number()
    .int()
    .min(1, 'Số người tối đa tối thiểu là 1')
    .optional(),
});

export const updateCaLamViecSchema = createCaLamViecSchema.partial();

export const phanCaSchema = z.object({
  MaNhanVien: z
    .string({ required_error: 'Mã nhân viên là bắt buộc' })
    .uuid('Mã nhân viên phải là định dạng UUID hợp lệ'),
  MaCa: z
    .string({ required_error: 'Mã ca làm việc là bắt buộc' })
    .uuid('Mã ca làm việc phải là định dạng UUID hợp lệ'),
  NgayLamViec: z
    .string({ required_error: 'Ngày làm việc là bắt buộc' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày làm việc phải ở định dạng YYYY-MM-DD'),
});

export const lichTrucQuerySchema = z.object({
  tuNgay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng từ ngày phải là YYYY-MM-DD').optional(),
  denNgay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng đến ngày phải là YYYY-MM-DD').optional(),
  maNhanVien: z.string().uuid('Mã nhân viên phải là UUID hợp lệ').optional(),
  maCa: z.string().uuid('Mã ca phải là UUID hợp lệ').optional(),
});

export type CreateCaLamViecInput = z.infer<typeof createCaLamViecSchema>;
export type UpdateCaLamViecInput = z.infer<typeof updateCaLamViecSchema>;
export type PhanCaInput = z.infer<typeof phanCaSchema>;
export type LichTrucQueryInput = z.infer<typeof lichTrucQuerySchema>;
