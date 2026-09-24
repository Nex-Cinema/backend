import { z } from 'zod';

export const validateTicketSchema = z.object({
  MaChiTietDat: z.string({
    required_error: 'Mã chi tiết đặt vé là bắt buộc',
  }).uuid('Mã chi tiết đặt vé không đúng định dạng UUID'),
});

export type ValidateTicketInput = z.infer<typeof validateTicketSchema>;

export const checkInSchema = z.object({
  MaChiTietDat: z.string({
    required_error: 'Mã chi tiết đặt vé là bắt buộc',
  }).uuid('Mã chi tiết đặt vé không đúng định dạng UUID'),
});

export type CheckInInput = z.infer<typeof checkInSchema>;

export const historyQuerySchema = z.object({
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
  tuNgay: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((val) => val === undefined || !isNaN(val.getTime()), 'Định dạng từ ngày không hợp lệ'),
  denNgay: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((val) => val === undefined || !isNaN(val.getTime()), 'Định dạng đến ngày không hợp lệ'),
  keyword: z.string().optional(),
});

export type HistoryQueryInput = z.infer<typeof historyQuerySchema>;
