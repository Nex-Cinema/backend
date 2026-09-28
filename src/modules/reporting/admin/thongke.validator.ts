import { z } from 'zod';

export const statsQuerySchema = z.object({
  tuNgay: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng từ ngày phải là YYYY-MM-DD')
    .optional(),
  denNgay: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng đến ngày phải là YYYY-MM-DD')
    .optional(),
  maPhim: z
    .string()
    .uuid('Mã phim phải là UUID hợp lệ')
    .optional(),
});

export type StatsQueryInput = z.infer<typeof statsQuerySchema>;
