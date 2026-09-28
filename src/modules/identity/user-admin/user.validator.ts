import { z } from 'zod';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../shared/pagination';

const phoneRegex = /^(0|84)(3|5|7|8|9)[0-9]{8}$/;

export const createUserSchema = z
  .object({
    TenDangNhap: z
      .string({ required_error: 'Tên đăng nhập là bắt buộc' })
      .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự')
      .max(50, 'Tên đăng nhập tối đa 50 ký tự')
      .regex(/^[a-zA-Z0-9_@.-]+$/, 'Tên đăng nhập chỉ được chứa chữ cái, số, dấu gạch dưới, gạch ngang, @ và dấu chấm'),
    MatKhau: z
      .string({ required_error: 'Mật khẩu là bắt buộc' })
      .min(6, 'Mật khẩu phải có ít nhất 6 ký tự')
      .max(50, 'Mật khẩu tối đa 50 ký tự'),
    HoTen: z
      .string({ required_error: 'Họ tên là bắt buộc' })
      .min(1, 'Họ tên không được để trống')
      .max(255, 'Họ tên tối đa 255 ký tự'),
    Email: z
      .string({ required_error: 'Email là bắt buộc' })
      .email('Email không đúng định dạng')
      .max(255, 'Email tối đa 255 ký tự'),
    SoDienThoai: z
      .string({ required_error: 'Số điện thoại là bắt buộc' })
      .regex(phoneRegex, 'Số điện thoại không đúng định dạng'),
    GioiTinh: z.boolean().optional(),
    NgaySinh: z.coerce.date().optional(),
    VaiTro: z.enum(['ADMIN', 'CUSTOMER'], { required_error: 'Vai trò là bắt buộc' }),
  })
  .strict();

export const updateUserSchema = z.object({
  HoTen: z
    .string()
    .min(1, 'Họ tên không được để trống')
    .max(255, 'Họ tên tối đa 255 ký tự')
    .optional(),
  Email: z
    .string()
    .email('Email không đúng định dạng')
    .max(255, 'Email tối đa 255 ký tự')
    .optional(),
  SoDienThoai: z
    .string()
    .regex(phoneRegex, 'Số điện thoại không đúng định dạng')
    .optional(),
  GioiTinh: z.boolean().optional(),
  NgaySinh: z.coerce.date().optional(),
  KhaDung: z.boolean().optional(),
}).strict();

export const adminChangePasswordSchema = z.object({
  MatKhau: z
    .string({ required_error: 'Mật khẩu là bắt buộc' })
    .min(6, 'Mật khẩu phải có ít nhất 6 ký tự')
    .max(50, 'Mật khẩu tối đa 50 ký tự'),
});

export const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  vaiTro: z.enum(['ADMIN', 'CUSTOMER']).optional(),
  khaDung: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  search: z.string().optional(),
}).strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AdminChangePasswordInput = z.infer<typeof adminChangePasswordSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
