import { z } from 'zod';

// ========================
// Allowed values
// ========================
const GIOI_HAN_TUOI = ['P', 'C13', 'C16', 'C18'] as const;

// ========================
// Create Movie Validator
// ========================
export const createPhimSchema = z
  .object({
    TenPhim: z
      .string({ required_error: 'Tên phim là bắt buộc' })
      .min(1, 'Tên phim không được để trống')
      .max(255, 'Tên phim tối đa 255 ký tự'),

    ThoiLuong: z
      .number({
        required_error: 'Thời lượng phim phải là số hợp lệ',
        invalid_type_error: 'Thời lượng phim phải là số hợp lệ',
      })
      .int('Thời lượng phim phải là số hợp lệ')
      .positive('Thời lượng phim phải là số hợp lệ'),

    TheLoai: z
      .string({ required_error: 'Thể loại là bắt buộc' })
      .min(1, 'Thể loại không được để trống')
      .max(255, 'Thể loại tối đa 255 ký tự'),

    NgayKhoiChieu: z
      .string({ required_error: 'Ngày khởi chiếu là bắt buộc' })
      .min(1, 'Ngày khởi chiếu không được để trống')
      .transform((val) => new Date(val))
      .refine((val) => !isNaN(val.getTime()), 'Ngày khởi chiếu không hợp lệ'),

    NgayKetThuc: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (val === undefined) return undefined;
        return val ? new Date(val) : null;
      })
      .refine(
        (val) => val === undefined || val === null || (val instanceof Date && !isNaN(val.getTime())),
        'Ngày kết thúc không hợp lệ',
      ),

    DaoDien: z
      .string()
      .max(255, 'Tên đạo diễn tối đa 255 ký tự')
      .optional()
      .nullable(),

    DienVien: z.string().optional().nullable(),

    GioiHanTuoi: z.enum(GIOI_HAN_TUOI, {
      required_error: 'Giới hạn tuổi là bắt buộc',
      invalid_type_error: 'Giới hạn tuổi không hợp lệ',
    }),

    NoiDung: z.string().optional().nullable(),

    Trailer: z
      .string({ required_error: 'Trailer là bắt buộc' })
      .min(1, 'Trailer không được để trống'),

    HinhAnh: z
      .string()
      .max(500, 'Đường dẫn hình ảnh tối đa 500 ký tự')
      .optional()
      .nullable(),

    KhaDung: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.NgayKetThuc && data.NgayKhoiChieu) {
        return data.NgayKetThuc >= data.NgayKhoiChieu;
      }
      return true;
    },
    {
      message: 'Ngày kết thúc không hợp lệ',
      path: ['NgayKetThuc'],
    },
  );

export type CreatePhimInput = z.infer<typeof createPhimSchema>;

// ========================
// Update Movie Validator
// ========================
export const updatePhimSchema = z
  .object({
    TenPhim: z
      .string()
      .min(1, 'Tên phim không được để trống')
      .max(255, 'Tên phim tối đa 255 ký tự')
      .optional(),

    ThoiLuong: z
      .number({
        invalid_type_error: 'Thời lượng phim phải là số hợp lệ',
      })
      .int('Thời lượng phim phải là số hợp lệ')
      .positive('Thời lượng phim phải là số hợp lệ')
      .optional(),

    TheLoai: z
      .string()
      .min(1, 'Thể loại không được để trống')
      .max(255, 'Thể loại tối đa 255 ký tự')
      .optional(),

    NgayKhoiChieu: z
      .string()
      .min(1, 'Ngày khởi chiếu không được để trống')
      .transform((val) => new Date(val))
      .refine((val) => !isNaN(val.getTime()), 'Ngày khởi chiếu không hợp lệ')
      .optional(),

    NgayKetThuc: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (val === undefined) return undefined;
        return val ? new Date(val) : null;
      })
      .refine(
        (val) => val === undefined || val === null || (val instanceof Date && !isNaN(val.getTime())),
        'Ngày kết thúc không hợp lệ',
      ),

    DaoDien: z
      .string()
      .max(255, 'Tên đạo diễn tối đa 255 ký tự')
      .optional()
      .nullable(),

    DienVien: z.string().optional().nullable(),

    GioiHanTuoi: z.enum(GIOI_HAN_TUOI, {
      invalid_type_error: 'Giới hạn tuổi không hợp lệ',
    }).optional(),

    NoiDung: z.string().optional().nullable(),

    Trailer: z
      .string()
      .min(1, 'Trailer không được để trống')
      .optional(),

    HinhAnh: z
      .string()
      .max(500, 'Đường dẫn hình ảnh tối đa 500 ký tự')
      .optional()
      .nullable(),

    KhaDung: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // Empty request body is not allowed
      const hasKeys = Object.keys(data).some(
        (key) => data[key as keyof typeof data] !== undefined
      );
      return hasKeys;
    },
    {
      message: 'Yêu cầu không được để trống body',
      path: [],
    },
  )
  .refine(
    (data) => {
      // Date rule still applies if both NgayKhoiChieu and NgayKetThuc are provided
      if (data.NgayKetThuc && data.NgayKhoiChieu) {
        return data.NgayKetThuc >= data.NgayKhoiChieu;
      }
      return true;
    },
    {
      message: 'Ngày kết thúc không hợp lệ',
      path: ['NgayKetThuc'],
    },
  );

export type UpdatePhimInput = z.infer<typeof updatePhimSchema>;

// ========================
// Params Validator
// ========================
export const phimParamSchema = z.object({
  maPhim: z.string().uuid('Mã phim không hợp lệ'),
});

// ========================
// Query Params Validator
// ========================
export const phimQuerySchema = z.object({
  keyword: z.string().optional(),
  theLoai: z.string().optional(),
  gioiHanTuoi: z.enum(GIOI_HAN_TUOI).optional(),
  tuNgayKhoiChieu: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((val) => val === undefined || !isNaN(val.getTime()), 'Từ ngày không hợp lệ'),
  denNgayKhoiChieu: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((val) => val === undefined || !isNaN(val.getTime()), 'Đến ngày không hợp lệ'),
  includeInactive: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
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
  sortBy: z
    .enum(['TenPhim', 'ThoiLuong', 'NgayKhoiChieu', 'NgayTao'])
    .optional()
    .default('NgayTao'),
  sortOrder: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc'),
});

export type PhimQueryInput = z.infer<typeof phimQuerySchema>;
