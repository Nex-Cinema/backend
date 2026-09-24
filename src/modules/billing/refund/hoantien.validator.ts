import { z } from 'zod';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../shared/pagination';

export const refundRequestSchema = z.object({
  MaPhieuDat: z.string({
    required_error: 'Mã phiếu đặt vé là bắt buộc',
  }).uuid('Mã phiếu đặt vé phải là UUID hợp lệ'),
  LyDo: z.string({
    required_error: 'Lý do hoàn tiền là bắt buộc',
  }).min(1, 'Lý do hoàn tiền không được để trống'),
  TenNganHang: z.string({
    required_error: 'Tên ngân hàng là bắt buộc',
  }).min(1, 'Tên ngân hàng không được để trống'),
  SoTaiKhoan: z.string({
    required_error: 'Số tài khoản là bắt buộc',
  }).min(1, 'Số tài khoản không được để trống'),
  TenChuTaiKhoan: z.string({
    required_error: 'Tên chủ tài khoản là bắt buộc',
  }).min(1, 'Tên chủ tài khoản không được để trống'),
});

export type RefundRequestInput = z.infer<typeof refundRequestSchema>;

export const refundListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type RefundListQueryInput = z.infer<typeof refundListQuerySchema>;

export const adminRefundQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  trangThai: z.enum(['CHO_XU_LY', 'DA_HOAN', 'TU_CHOI']).optional(),
  keyword: z.string().optional(),
});

export type AdminRefundQueryInput = z.infer<typeof adminRefundQuerySchema>;

export const adminRefundParamsSchema = z.object({
  maHoanTien: z.string({
    required_error: 'Mã yêu cầu hoàn tiền là bắt buộc',
  }).uuid('Mã yêu cầu hoàn tiền phải là UUID hợp lệ'),
});

export type AdminRefundParamsInput = z.infer<typeof adminRefundParamsSchema>;

export const adminRefundApproveSchema = z.object({
  GhiChu: z.string().optional(),
});

export type AdminRefundApproveInput = z.infer<typeof adminRefundApproveSchema>;

export const adminRefundRejectSchema = z.object({
  LyDoTuChoi: z.string({
    required_error: 'Lý do từ chối không được để trống',
  }).min(1, 'Lý do từ chối không được để trống'),
});

export type AdminRefundRejectInput = z.infer<typeof adminRefundRejectSchema>;
