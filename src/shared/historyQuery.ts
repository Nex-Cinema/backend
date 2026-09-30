import { z } from 'zod';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './pagination';

export const historyQuerySchema = z.object({
  page: z.string().optional().transform((value) => (value ? parseInt(value, 10) : DEFAULT_PAGE))
    .refine((value) => value >= 1, 'Trang phải lớn hơn hoặc bằng 1'),
  limit: z.string().optional().transform((value) => (value ? parseInt(value, 10) : DEFAULT_PAGE_SIZE))
    .refine(
      (value) => value >= 1 && value <= MAX_PAGE_SIZE,
      `Số lượng mỗi trang phải từ 1 đến ${MAX_PAGE_SIZE}`,
    ),
  tuNgay: z.string().optional().transform((value) => (value ? new Date(value) : undefined))
    .refine((value) => value === undefined || !Number.isNaN(value.getTime()), 'Định dạng từ ngày không hợp lệ'),
  denNgay: z.string().optional().transform((value) => (value ? new Date(value) : undefined))
    .refine((value) => value === undefined || !Number.isNaN(value.getTime()), 'Định dạng đến ngày không hợp lệ'),
  keyword: z.string().optional(),
});

export type HistoryQueryInput = z.infer<typeof historyQuerySchema>;
