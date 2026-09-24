import { z } from 'zod';

export const staffShowtimeQuerySchema = z.object({
  keyword: z.string().optional(),
  ngayChieu: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((val) => val === undefined || !isNaN(val.getTime()), 'Ngày chiếu không hợp lệ'),
  maPhim: z.string().uuid('Mã phim không đúng định dạng UUID').optional(),
  maPhong: z.string().uuid('Mã phòng không đúng định dạng UUID').optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val >= 1, 'Trang phải lớn hơn hoặc bằng 1'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine(
      (val) => val >= 1 && val <= 100,
      'Số lượng mỗi trang phải từ 1 đến 100',
    ),
});

export type StaffShowtimeQueryInput = z.infer<typeof staffShowtimeQuerySchema>;

export const maSuatChieuParamSchema = z.object({
  maSuatChieu: z.string().uuid('Mã suất chiếu không đúng định dạng UUID'),
});

export type MaSuatChieuParamInput = z.infer<typeof maSuatChieuParamSchema>;

export const staffSellTicketSchema = z
  .object({
    MaSuatChieu: z.string({ required_error: 'Mã suất chiếu là bắt buộc' }).uuid('Mã suất chiếu không đúng định dạng UUID'),
    DanhSachMaGheSuatChieu: z
      .array(z.string().uuid('Mã ghế suất chiếu không đúng định dạng UUID'), {
        required_error: 'Danh sách mã ghế suất chiếu là bắt buộc',
      })
      .min(1, 'Danh sách mã ghế phải có ít nhất 1 ghế'),
    PhuongThuc: z.enum(['TIEN_MAT', 'CHUYEN_KHOAN'], {
      required_error: 'Phương thức thanh toán là bắt buộc',
      invalid_type_error: 'Phương thức thanh toán không hợp lệ',
    }),
    MaGiaoDichNgoai: z.string().max(255, 'Mã giao dịch ngoài tối đa 255 ký tự').optional(),
    GhiChu: z.string().optional(),
  })
  .refine(
    (data) => {
      // Reject duplicate seat IDs
      const uniqueSeats = new Set(data.DanhSachMaGheSuatChieu);
      return uniqueSeats.size === data.DanhSachMaGheSuatChieu.length;
    },
    {
      message: 'Danh sách ghế có mã trùng lặp',
      path: ['DanhSachMaGheSuatChieu'],
    }
  );

export type StaffSellTicketInput = z.infer<typeof staffSellTicketSchema>;
