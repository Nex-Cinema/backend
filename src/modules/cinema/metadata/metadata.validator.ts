import { z } from 'zod';

// ========================
// Loại Phòng Validators
// ========================
export const createLoaiPhongSchema = z.object({
  TenLoaiPhong: z
    .string({ required_error: 'Tên loại phòng là bắt buộc' })
    .min(1, 'Tên loại phòng không được để trống')
    .max(100, 'Tên loại phòng tối đa 100 ký tự'),
  PhuThu: z
    .number({
      required_error: 'Phụ thu là bắt buộc và phải là số',
      invalid_type_error: 'Phụ thu phải là số hợp lệ',
    })
    .min(0, 'Phụ thu không được âm'),
});

export const updateLoaiPhongSchema = z.object({
  TenLoaiPhong: z
    .string()
    .min(1, 'Tên loại phòng không được để trống')
    .max(100, 'Tên loại phòng tối đa 100 ký tự')
    .optional(),
  PhuThu: z
    .number({ invalid_type_error: 'Phụ thu phải là số hợp lệ' })
    .min(0, 'Phụ thu không được âm')
    .optional(),
  KhaDung: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Yêu cầu không được để trống body' }
);

export type CreateLoaiPhongInput = z.infer<typeof createLoaiPhongSchema>;
export type UpdateLoaiPhongInput = z.infer<typeof updateLoaiPhongSchema>;

// ========================
// Loại Ghế Validators
// ========================
export const createLoaiGheSchema = z.object({
  TenLoaiGhe: z
    .string({ required_error: 'Tên loại ghế là bắt buộc' })
    .min(1, 'Tên loại ghế không được để trống')
    .max(100, 'Tên loại ghế tối đa 100 ký tự'),
  PhuThu: z
    .number({
      required_error: 'Phụ thu là bắt buộc và phải là số',
      invalid_type_error: 'Phụ thu phải là số hợp lệ',
    })
    .min(0, 'Phụ thu không được âm'),
});

export const updateLoaiGheSchema = z.object({
  TenLoaiGhe: z
    .string()
    .min(1, 'Tên loại ghế không được để trống')
    .max(100, 'Tên loại ghế tối đa 100 ký tự')
    .optional(),
  PhuThu: z
    .number({ invalid_type_error: 'Phụ thu phải là số hợp lệ' })
    .min(0, 'Phụ thu không được âm')
    .optional(),
  KhaDung: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Yêu cầu không được để trống body' }
);

export type CreateLoaiGheInput = z.infer<typeof createLoaiGheSchema>;
export type UpdateLoaiGheInput = z.infer<typeof updateLoaiGheSchema>;

// ========================
// Loại Ngày Validators
// ========================
export const createLoaiNgaySchema = z.object({
  TenLoaiNgay: z
    .string({ required_error: 'Tên loại ngày là bắt buộc' })
    .min(1, 'Tên loại ngày không được để trống')
    .max(100, 'Tên loại ngày tối đa 100 ký tự'),
  PhuThu: z
    .number({
      required_error: 'Phụ thu là bắt buộc và phải là số',
      invalid_type_error: 'Phụ thu phải là số hợp lệ',
    })
    .min(0, 'Phụ thu không được âm'),
});

export const updateLoaiNgaySchema = z.object({
  TenLoaiNgay: z
    .string()
    .min(1, 'Tên loại ngày không được để trống')
    .max(100, 'Tên loại ngày tối đa 100 ký tự')
    .optional(),
  PhuThu: z
    .number({ invalid_type_error: 'Phụ thu phải là số hợp lệ' })
    .min(0, 'Phụ thu không được âm')
    .optional(),
  KhaDung: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Yêu cầu không được để trống body' }
);

export type CreateLoaiNgayInput = z.infer<typeof createLoaiNgaySchema>;
export type UpdateLoaiNgayInput = z.infer<typeof updateLoaiNgaySchema>;
