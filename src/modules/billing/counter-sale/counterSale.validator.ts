import { z } from 'zod';

export const counterSaleSchema = z.object({
  MaSuatChieu: z.string().uuid('Mã suất chiếu không hợp lệ'),
  DanhSachMaGheSuatChieu: z.array(z.string().uuid('Mã ghế không hợp lệ')).min(1, 'Phải chọn ít nhất một ghế'),
  PhuongThucThanhToan: z.enum(['TIEN_MAT', 'PAYOS']),
  TenKhachHang: z.string().trim().max(255).optional(),
  SoDienThoai: z.string().trim().regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0').optional(),
});

export const counterPayosBookingParamSchema = z.object({
  maPhieuDat: z.string().uuid('Mã phiếu đặt không hợp lệ'),
});

export const counterPayosStatusParamSchema = z.object({
  maGiaoDich: z.string().uuid('Mã giao dịch không hợp lệ'),
});
