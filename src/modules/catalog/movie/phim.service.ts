import { Phim } from '@prisma/client';
import {
  findById,
  findManyWithFilters,
  countWithFilters,
  findDuplicateMovie,
  create,
  update,
  softDelete,
  restore,
  countRelatedTicketDetailsByMovieId,
  findActiveById,
  findPublicShowtimesByMovieId,
} from './phim.repository';
import {
  CreatePhimInput,
  UpdatePhimInput,
  PhimQueryInput,
} from './phim.validator';
import { NotFoundError, BadRequestError } from '../../../utils/errors';
import prisma from '../../../config/prisma';
import { combineShowtimeDateTime } from '../../../utils/showtimeDateTime';

// ========================
// Types
// ========================
export interface PhimListResult {
  items: Phim[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ========================
// Helper: Assert phim exists
// ========================
const assertPhimExists = async (maPhim: string): Promise<Phim> => {
  const phim = await findById(maPhim);
  if (!phim) {
    throw new NotFoundError(`Không tìm thấy phim với mã: ${maPhim}`);
  }
  return phim;
};

// ========================
// Service: Get list of movies
// ========================
export const getDanhSachPhim = async (
  query: PhimQueryInput,
  userRole?: string,
): Promise<PhimListResult> => {
  // Non-admin users must never see inactive movies
  if (userRole !== 'ADMIN') {
    query.includeInactive = false;
  }

  const items = await findManyWithFilters(query);
  const total = await countWithFilters(query);
  const limit = query.limit ?? 10;

  return {
    items,
    total,
    page: query.page ?? 1,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// ========================
// Service: Get single movie by ID
// ========================
export const getChiTietPhim = async (
  maPhim: string,
  userRole?: string,
): Promise<Phim> => {
  const phim = await assertPhimExists(maPhim);

  // Non-admin users must never see inactive movies
  if (!phim.KhaDung && userRole !== 'ADMIN') {
    throw new NotFoundError(`Không tìm thấy phim với mã: ${maPhim}`);
  }

  return phim;
};

// ========================
// Service: Get public showtimes by movie ID
// ========================
export const getSuatChieuCuaPhim = async (maPhim: string) => {
  const phim = await findActiveById(maPhim);
  if (!phim) {
    throw new NotFoundError(`Không tìm thấy phim với mã: ${maPhim}`);
  }

  const now = new Date();
  const suatChieus = await findPublicShowtimesByMovieId(maPhim);

  return suatChieus
    .filter((suatChieu) => {
      const showtimeStart = combineShowtimeDateTime(suatChieu.NgayChieu, suatChieu.GioChieu);
      return showtimeStart >= now;
    })
    .map((suatChieu) => ({
      ...suatChieu,
      GiaVeGoc: Number(suatChieu.GiaVeGoc),
      PhongChieu: {
        ...suatChieu.PhongChieu,
        LoaiPhong: {
          ...suatChieu.PhongChieu.LoaiPhong,
          PhuThu: Number(suatChieu.PhongChieu.LoaiPhong.PhuThu),
        },
      },
      LoaiNgay: {
        ...suatChieu.LoaiNgay,
        PhuThu: Number(suatChieu.LoaiNgay.PhuThu),
      },
    }));
};

// ========================
// Service: Create a new movie
// ========================
export const taoPhim = async (input: CreatePhimInput): Promise<Phim> => {
  // Business rule: Duplicate check for active movie with same TenPhim & NgayKhoiChieu
  const duplicate = await findDuplicateMovie(input.TenPhim, input.NgayKhoiChieu);
  if (duplicate) {
    throw new BadRequestError(
      `Phim "${input.TenPhim}" khởi chiếu vào ngày ${input.NgayKhoiChieu.toLocaleDateString('vi-VN')} đã tồn tại`,
    );
  }

  return create({
    TenPhim: input.TenPhim,
    ThoiLuong: input.ThoiLuong,
    TheLoai: input.TheLoai,
    NgayKhoiChieu: input.NgayKhoiChieu,
    NgayKetThuc: input.NgayKetThuc ?? null,
    DaoDien: input.DaoDien ?? null,
    DienVien: input.DienVien ?? null,
    GioiHanTuoi: input.GioiHanTuoi,
    NoiDung: input.NoiDung ?? null,
    Trailer: input.Trailer,
    HinhAnh: input.HinhAnh ?? null,
    KhaDung: input.KhaDung ?? true,
  });
};

const checkCanUpdateActiveStatus = async (maPhim: string): Promise<void> => {
  const showtimes = await prisma.suatChieu.findMany({
    where: { MaPhim: maPhim },
    select: { NgayChieu: true, GioChieu: true },
  });

  const now = new Date();
  const hasFutureShowtime = showtimes.some((sc) => {
    const startDateTime = combineShowtimeDateTime(sc.NgayChieu, sc.GioChieu);
    return startDateTime >= now;
  });

  if (hasFutureShowtime) {
    throw new BadRequestError(
      'Không thể cập nhật trạng thái khả dụng của phim khi phim đang có suất chiếu trong tương lai.',
    );
  }
};

// ========================
// Service: Update a movie
// ========================
export const capNhatPhim = async (
  maPhim: string,
  input: UpdatePhimInput,
): Promise<Phim> => {
  const existing = await assertPhimExists(maPhim);

  // Compare dates: if only one date is provided, compare with existing date from DB
  const ngayKhoiChieu = input.NgayKhoiChieu ?? existing.NgayKhoiChieu;
  const ngayKetThuc = input.NgayKetThuc !== undefined ? input.NgayKetThuc : existing.NgayKetThuc;

  if (ngayKetThuc && ngayKhoiChieu && ngayKetThuc < ngayKhoiChieu) {
    throw new BadRequestError('Ngày kết thúc không hợp lệ');
  }

  // Duplicate check: must ignore the current MaPhim
  const tenPhim = input.TenPhim ?? existing.TenPhim;
  const duplicate = await findDuplicateMovie(tenPhim, ngayKhoiChieu, maPhim);
  if (duplicate) {
    throw new BadRequestError(
      `Phim "${tenPhim}" khởi chiếu vào ngày ${ngayKhoiChieu.toLocaleDateString('vi-VN')} đã tồn tại`,
    );
  }

  if (input.KhaDung !== undefined && input.KhaDung !== existing.KhaDung) {
    await checkCanUpdateActiveStatus(maPhim);
  }

  return update(maPhim, {
    ...(input.TenPhim !== undefined && { TenPhim: input.TenPhim }),
    ...(input.ThoiLuong !== undefined && { ThoiLuong: input.ThoiLuong }),
    ...(input.TheLoai !== undefined && { TheLoai: input.TheLoai }),
    ...(input.NgayKhoiChieu !== undefined && { NgayKhoiChieu: input.NgayKhoiChieu }),
    ...(input.NgayKetThuc !== undefined && { NgayKetThuc: input.NgayKetThuc }),
    ...(input.DaoDien !== undefined && { DaoDien: input.DaoDien }),
    ...(input.DienVien !== undefined && { DienVien: input.DienVien }),
    ...(input.GioiHanTuoi !== undefined && { GioiHanTuoi: input.GioiHanTuoi }),
    ...(input.NoiDung !== undefined && { NoiDung: input.NoiDung }),
    ...(input.Trailer !== undefined && { Trailer: input.Trailer }),
    ...(input.HinhAnh !== undefined && { HinhAnh: input.HinhAnh }),
    ...(input.KhaDung !== undefined && { KhaDung: input.KhaDung }),
  });
};

// ========================
// Service: Soft delete a movie
// ========================
export const anPhim = async (maPhim: string): Promise<Phim> => {
  const existing = await assertPhimExists(maPhim);
  if (existing.KhaDung) {
    await checkCanUpdateActiveStatus(maPhim);
  }
  return softDelete(maPhim);
};

// ========================
// Service: Restore a movie
// ========================
export const khoiPhucPhim = async (maPhim: string): Promise<Phim> => {
  const existing = await assertPhimExists(maPhim);
  if (!existing.KhaDung) {
    await checkCanUpdateActiveStatus(maPhim);
  }
  return restore(maPhim);
};

// ========================
// Service: Hard delete a movie
// ========================
export const xoaPhim = async (maPhim: string): Promise<void> => {
  await assertPhimExists(maPhim);

  // Check if any ticket details exist related to this movie
  const ticketCount = await countRelatedTicketDetailsByMovieId(maPhim);
  if (ticketCount > 0) {
    throw new BadRequestError('Phim không thể xóa');
  }

  // Block deletion if any showtimes exist
  const showtimeCount = await prisma.suatChieu.count({
    where: { MaPhim: maPhim },
  });
  if (showtimeCount > 0) {
    throw new BadRequestError('Phim không thể xóa');
  }

  // Safely cleanup showtimes & seats of those showtimes if no ticket details exist (though showtimeCount check above makes this dead code, keeping it for prisma transaction safety)
  await prisma.$transaction(async (tx) => {
    // 1. Delete all DanhGia related to this phim
    await tx.danhGia.deleteMany({
      where: { MaPhim: maPhim },
    });

    // 2. Find showtime IDs
    const showtimes = await tx.suatChieu.findMany({
      where: { MaPhim: maPhim },
      select: { MaSuatChieu: true },
    });
    const showtimeIds = showtimes.map((s) => s.MaSuatChieu);

    if (showtimeIds.length > 0) {
      // 3. Delete GheSuatChieu
      await tx.gheSuatChieu.deleteMany({
        where: { MaSuatChieu: { in: showtimeIds } },
      });

      // 4. Delete SuatChieu
      await tx.suatChieu.deleteMany({
        where: { MaPhim: maPhim },
      });
    }

    // 5. Delete Phim
    await tx.phim.delete({
      where: { MaPhim: maPhim },
    });
  });
};
