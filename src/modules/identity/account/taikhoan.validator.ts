import { z } from 'zod';

// Restricted fields that must be explicitly rejected
const RESTRICTED_FIELDS = [
  'TenDangNhap',
  'MatKhau',
  'VaiTro',
  'KhaDung',
  'MaTaiKhoan',
  'MaKhachHang',
  'NgayTao',
  'NgayCapNhat',
];

export const updateProfileSchema = z
  .object({
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
      .max(20, 'Số điện thoại tối đa 20 ký tự')
      .optional(),
    GioiTinh: z.boolean().optional(),
    NgaySinh: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((val) => !val || !isNaN(val.getTime()), 'Ngày sinh không hợp lệ'),

    // Restricted fields declared as optional any so they can be parsed and rejected in refinement
    TenDangNhap: z.any().optional(),
    MatKhau: z.any().optional(),
    VaiTro: z.any().optional(),
    KhaDung: z.any().optional(),
    MaTaiKhoan: z.any().optional(),
    MaKhachHang: z.any().optional(),
    NgayTao: z.any().optional(),
    NgayCapNhat: z.any().optional(),
  })
  .refine(
    (data) => {
      // Reject if any restricted field is present
      for (const field of RESTRICTED_FIELDS) {
        if ((data as any)[field] !== undefined) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'Không được phép cập nhật các trường hạn chế',
      path: ['restricted_fields'],
    }
  )
  .refine(
    (data) => {
      // Empty body check (must have at least one allowed field to update)
      const allowedFields = ['HoTen', 'Email', 'SoDienThoai', 'GioiTinh', 'NgaySinh'];
      return allowedFields.some((field) => (data as any)[field] !== undefined);
    },
    {
      message: 'Dữ liệu cập nhật không được để trống',
    }
  );

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    MatKhauCu: z.string({ required_error: 'Mật khẩu cũ là bắt buộc' }).min(1, 'Mật khẩu cũ không được để trống'),
    MatKhauMoi: z
      .string({ required_error: 'Mật khẩu mới là bắt buộc' })
      .min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự')
      .max(100, 'Mật khẩu mới tối đa 100 ký tự'),
    XacNhanMatKhauMoi: z
      .string({ required_error: 'Xác nhận mật khẩu mới là bắt buộc' })
      .min(1, 'Xác nhận mật khẩu mới không được để trống'),
  })
  .refine((data) => data.MatKhauMoi === data.XacNhanMatKhauMoi, {
    message: 'Mật khẩu mới và xác nhận mật khẩu mới không khớp',
    path: ['XacNhanMatKhauMoi'],
  })
  .refine((data) => data.MatKhauMoi !== data.MatKhauCu, {
    message: 'Mật khẩu mới phải khác mật khẩu cũ',
    path: ['MatKhauMoi'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
