import { z } from 'zod';

export const shiftTemplateQuerySchema = z.object({
  ngayLamViec: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((val) => val === undefined || !isNaN(val.getTime()), 'Ngày làm việc không hợp lệ'),
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

export type ShiftTemplateQueryInput = z.infer<typeof shiftTemplateQuerySchema>;

export const myScheduleQuerySchema = z
  .object({
    tuNgay: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((val) => val === undefined || !isNaN(val.getTime()), 'Từ ngày không hợp lệ'),
    denNgay: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined))
      .refine((val) => val === undefined || !isNaN(val.getTime()), 'Đến ngày không hợp lệ'),
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
  })
  .refine(
    (data) => {
      if (data.tuNgay && data.denNgay) {
        return data.denNgay >= data.tuNgay;
      }
      return true;
    },
    {
      message: 'Đến ngày phải lớn hơn hoặc bằng từ ngày',
      path: ['denNgay'],
    }
  );

export type MyScheduleQueryInput = z.infer<typeof myScheduleQuerySchema>;

export const registerShiftSchema = z.object({
  MaCa: z
    .string({ required_error: 'Mã ca làm việc là bắt buộc' })
    .uuid('Mã ca làm việc không đúng định dạng UUID'),
  NgayLamViec: z
    .string({ required_error: 'Ngày làm việc là bắt buộc' })
    .transform((val) => new Date(val))
    .refine((val) => !isNaN(val.getTime()), 'Ngày làm việc không hợp lệ'),
});

export type RegisterShiftInput = z.infer<typeof registerShiftSchema>;

export const cancelShiftParamSchema = z.object({
  maChiTietCa: z
    .string({ required_error: 'Mã chi tiết ca làm là bắt buộc' })
    .uuid('Mã chi tiết ca làm không đúng định dạng UUID'),
});

export type CancelShiftParamInput = z.infer<typeof cancelShiftParamSchema>;
