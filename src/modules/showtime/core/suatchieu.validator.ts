import { z } from 'zod';

export const createSuatChieuSchema = z.object({
  MaPhim: z
    .string({ required_error: 'Mã phim là bắt buộc' })
    .uuid('Mã phim phải là định dạng UUID hợp lệ'),
  MaPhong: z
    .string({ required_error: 'Mã phòng chiếu là bắt buộc' })
    .uuid('Mã phòng chiếu phải là định dạng UUID hợp lệ'),
  MaLoaiNgay: z
    .string({ required_error: 'Mã loại ngày là bắt buộc' })
    .uuid('Mã loại ngày phải là định dạng UUID hợp lệ'),
  NgayChieu: z.coerce.date({
    required_error: 'Ngày chiếu là bắt buộc',
    invalid_type_error: 'Ngày chiếu không hợp lệ',
  }),
  GioChieu: z.coerce.date({
    required_error: 'Giờ chiếu là bắt buộc',
    invalid_type_error: 'Giờ chiếu không hợp lệ',
  }),
  GiaVeGoc: z
    .number({ required_error: 'Giá vé gốc là bắt buộc' })
    .positive('Giá vé gốc phải là số dương'),
  KhaDung: z.boolean().optional(),
});

export type CreateSuatChieuInput = z.infer<typeof createSuatChieuSchema>;

export const updateSuatChieuSchema = z.object({
  MaPhim: z
    .string()
    .uuid('Mã phim phải là định dạng UUID hợp lệ')
    .optional(),
  MaPhong: z
    .string()
    .uuid('Mã phòng chiếu phải là định dạng UUID hợp lệ')
    .optional(),
  MaLoaiNgay: z
    .string()
    .uuid('Mã loại ngày phải là định dạng UUID hợp lệ')
    .optional(),
  NgayChieu: z.coerce.date({ invalid_type_error: 'Ngày chiếu không hợp lệ' }).optional(),
  GioChieu: z.coerce.date({ invalid_type_error: 'Giờ chiếu không hợp lệ' }).optional(),
  GiaVeGoc: z.number().positive('Giá vé gốc phải là số dương').optional(),
  KhaDung: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Yêu cầu không được để trống body' }
);

export type UpdateSuatChieuInput = z.infer<typeof updateSuatChieuSchema>;

export const showtimeIdParamSchema = z.object({
  maSuatChieu: z.string().uuid('Mã suất chiếu phải là định dạng UUID hợp lệ'),
});
