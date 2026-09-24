import { z } from 'zod';

export const seatHoldSchema = z.object({
  MaSuatChieu: z.string({
    required_error: 'Mã suất chiếu là bắt buộc',
  }).uuid('Mã suất chiếu phải là định dạng UUID hợp lệ'),
  
  DanhSachMaGheSuatChieu: z
    .array(
      z.string().uuid('Mã ghế suất chiếu phải là định dạng UUID hợp lệ')
    , {
      required_error: 'Danh sách mã ghế là bắt buộc',
      invalid_type_error: 'Danh sách mã ghế phải là một mảng',
    })
    .min(1, 'Danh sách mã ghế phải có ít nhất 1 ghế'),
});

export type SeatHoldInput = z.infer<typeof seatHoldSchema>;

export const showtimeIdParamSchema = z.object({
  maSuatChieu: z.string().uuid('Mã suất chiếu phải là định dạng UUID hợp lệ'),
});

export type ShowtimeIdParam = z.infer<typeof showtimeIdParamSchema>;

// ========================
// New Validators for Booking & Payment
// ========================

export const paymentSimulationSchema = z.object({
  MaSuatChieu: z.string({
    required_error: 'Mã suất chiếu là bắt buộc',
  }).uuid('Mã suất chiếu phải là định dạng UUID hợp lệ'),

  DanhSachMaGheSuatChieu: z
    .array(
      z.string().uuid('Mã ghế suất chiếu phải là định dạng UUID hợp lệ'),
      {
        required_error: 'Danh sách mã ghế là bắt buộc',
        invalid_type_error: 'Danh sách mã ghế phải là một mảng',
      }
    )
    .min(1, 'Danh sách mã ghế phải có ít nhất 1 ghế')
    .refine((items) => new Set(items).size === items.length, {
      message: 'Danh sách mã ghế không được chứa giá trị trùng lặp',
    }),

  PhuongThucThanhToan: z.literal('TIEN_MAT', {
    required_error: 'Phương thức thanh toán là bắt buộc',
    invalid_type_error: 'Phương thức thanh toán giả lập phải là TIEN_MAT',
  }),

  KetQuaThanhToan: z.enum(['THANH_CONG', 'THAT_BAI'], {
    required_error: 'Kết quả thanh toán là bắt buộc',
    invalid_type_error: 'Kết quả thanh toán phải là THANH_CONG hoặc THAT_BAI',
  }),
});

export type PaymentSimulationInput = z.infer<typeof paymentSimulationSchema>;

export const realPaymentSchema = z.object({
  MaSuatChieu: z.string({
    required_error: 'Mã suất chiếu là bắt buộc',
  }).uuid('Mã suất chiếu phải là định dạng UUID hợp lệ'),

  DanhSachMaGheSuatChieu: z
    .array(
      z.string().uuid('Mã ghế suất chiếu phải là định dạng UUID hợp lệ'),
      {
        required_error: 'Danh sách mã ghế là bắt buộc',
        invalid_type_error: 'Danh sách mã ghế phải là một mảng',
      }
    )
    .min(1, 'Danh sách mã ghế phải có ít nhất 1 ghế')
    .refine((items) => new Set(items).size === items.length, {
      message: 'Danh sách mã ghế không được chứa giá trị trùng lặp',
    }),

  PhuongThucThanhToan: z.enum(['VNPAY', 'TIEN_MAT', 'PAYOS'], {
    required_error: 'Phương thức thanh toán là bắt buộc',
    invalid_type_error: 'Phương thức thanh toán phải là VNPAY, TIEN_MAT hoặc PAYOS',
  }),
});

export type RealPaymentInput = z.infer<typeof realPaymentSchema>;

export const cancelBookingParamSchema = z.object({
  maPhieuDat: z.string({
    required_error: 'Mã phiếu đặt vé là bắt buộc',
  }).uuid('Mã phiếu đặt vé phải là định dạng UUID hợp lệ'),
});

export type CancelBookingParam = z.infer<typeof cancelBookingParamSchema>;

export const cancelBookingBodySchema = z.object({
  LyDoHoan: z.string().optional(),
  TenNganHang: z.string().optional(),
  SoTaiKhoan: z.string().optional(),
  TenChuTaiKhoan: z.string().optional(),
});

export type CancelBookingBody = z.infer<typeof cancelBookingBodySchema>;
