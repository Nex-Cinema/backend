import { z } from 'zod';

// ========================
// Create Screening Room Validator
// ========================
export const createPhongChieuSchema = z.object({
  TenPhong: z
    .string({ required_error: 'Tên phòng chiếu là bắt buộc' })
    .min(1, 'Tên phòng chiếu không được để trống')
    .max(100, 'Tên phòng chiếu tối đa 100 ký tự'),
  MaLoaiPhong: z
    .string({ required_error: 'Loại phòng là bắt buộc' })
    .uuid('Mã loại phòng phải là định dạng UUID hợp lệ'),
  MaSoDo: z
    .string({ required_error: 'Sơ đồ ghế là bắt buộc' })
    .uuid('Mã sơ đồ ghế phải là định dạng UUID hợp lệ'),
  KhaDung: z.boolean().optional(),
});

export type CreatePhongChieuInput = z.infer<typeof createPhongChieuSchema>;

// ========================
// Update Screening Room Validator
// ========================
export const updatePhongChieuSchema = z.object({
  TenPhong: z
    .string()
    .min(1, 'Tên phòng chiếu không được để trống')
    .max(100, 'Tên phòng chiếu tối đa 100 ký tự')
    .optional(),
  MaLoaiPhong: z
    .string()
    .uuid('Mã loại phòng phải là định dạng UUID hợp lệ')
    .optional(),
  MaSoDo: z
    .string()
    .uuid('Mã sơ đồ ghế phải là định dạng UUID hợp lệ')
    .optional(),
  KhaDung: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Yêu cầu không được để trống body' }
);

export type UpdatePhongChieuInput = z.infer<typeof updatePhongChieuSchema>;

// ========================
// Bulk Update Seats Validator
// ========================
export const updateGheItemSchema = z.object({
  maGhe: z
    .string({ required_error: 'Mã ghế là bắt buộc' })
    .uuid('Mã ghế phải là định dạng UUID hợp lệ'),
  maLoaiGhe: z
    .string({ required_error: 'Mã loại ghế là bắt buộc' })
    .uuid('Mã loại ghế phải là định dạng UUID hợp lệ'),
  khaDung: z.boolean({ required_error: 'Trạng thái khả dụng là bắt buộc' }),
});

export const updateGhesSchema = z.object({
  ghes: z
    .array(updateGheItemSchema, { required_error: 'Danh sách ghế cập nhật là bắt buộc' })
    .min(1, 'Danh sách ghế cập nhật không được rỗng'),
});

export type UpdateGhesInput = z.infer<typeof updateGhesSchema>;
export type UpdateGheItem = z.infer<typeof updateGheItemSchema>;
