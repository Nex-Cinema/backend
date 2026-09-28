import { Phim, Prisma } from '@prisma/client';
import prisma from '../../../config/prisma';
import { PhimQueryInput } from './phim.validator';

// ========================
// Helper: Build Where Clause
// ========================
const buildWhereClause = (query: PhimQueryInput): Prisma.PhimWhereInput => {
  const {
    keyword,
    theLoai,
    gioiHanTuoi,
    tuNgayKhoiChieu,
    denNgayKhoiChieu,
    includeInactive,
  } = query;

  const where: Prisma.PhimWhereInput = {};

  // If includeInactive is false or undefined, only find active movies
  if (!includeInactive) {
    where.KhaDung = true;
  }

  // Search in TenPhim, TheLoai, DaoDien, DienVien
  if (keyword) {
    where.OR = [
      { TenPhim: { contains: keyword } },
      { TheLoai: { contains: keyword } },
      { DaoDien: { contains: keyword } },
      { DienVien: { contains: keyword } },
    ];
  }

  if (theLoai) {
    where.TheLoai = { contains: theLoai };
  }

  if (gioiHanTuoi) {
    where.GioiHanTuoi = gioiHanTuoi;
  }

  if (tuNgayKhoiChieu || denNgayKhoiChieu) {
    where.NgayKhoiChieu = {};
    if (tuNgayKhoiChieu) {
      where.NgayKhoiChieu.gte = tuNgayKhoiChieu;
    }
    if (denNgayKhoiChieu) {
      where.NgayKhoiChieu.lte = denNgayKhoiChieu;
    }
  }

  return where;
};

// ========================
// Repository Functions
// ========================

/**
 * Get a list of Phim with filtering, search, and pagination
 */
export const findManyWithFilters = async (
  query: PhimQueryInput,
): Promise<Phim[]> => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'NgayTao',
    sortOrder = 'desc',
  } = query;

  const where = buildWhereClause(query);
  const skip = (page - 1) * limit;

  return prisma.phim.findMany({
    where,
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder,
    },
  });
};

/**
 * Count the total matching Phim with filtering and search
 */
export const countWithFilters = async (
  query: PhimQueryInput,
): Promise<number> => {
  const where = buildWhereClause(query);
  return prisma.phim.count({ where });
};

/**
 * Find a Phim by ID (can be active or inactive)
 */
export const findById = async (maPhim: string): Promise<Phim | null> => {
  return prisma.phim.findUnique({
    where: { MaPhim: maPhim },
  });
};

/**
 * Find an active Phim by ID
 */
export const findActiveById = async (maPhim: string): Promise<Phim | null> => {
  return prisma.phim.findFirst({
    where: { MaPhim: maPhim, KhaDung: true },
  });
};

/**
 * Find public active showtimes for an active movie.
 */
export const findPublicShowtimesByMovieId = async (maPhim: string) => {
  return prisma.suatChieu.findMany({
    where: {
      MaPhim: maPhim,
      KhaDung: true,
      Phim: {
        KhaDung: true,
      },
      PhongChieu: {
        KhaDung: true,
        LoaiPhong: {
          KhaDung: true,
        },
      },
      LoaiNgay: {
        KhaDung: true,
      },
    },
    select: {
      MaSuatChieu: true,
      MaPhim: true,
      MaPhong: true,
      MaLoaiNgay: true,
      NgayChieu: true,
      GioChieu: true,
      GiaVeGoc: true,
      PhongChieu: {
        select: {
          MaPhong: true,
          TenPhong: true,
          LoaiPhong: {
            select: {
              MaLoaiPhong: true,
              TenLoaiPhong: true,
              PhuThu: true,
            },
          },
        },
      },
      LoaiNgay: {
        select: {
          MaLoaiNgay: true,
          TenLoaiNgay: true,
          PhuThu: true,
        },
      },
    },
    orderBy: [
      { NgayChieu: 'asc' },
      { GioChieu: 'asc' },
    ],
  });
};

/**
 * Find duplicate active movie with same TenPhim and NgayKhoiChieu (excluding a MaPhim when updating)
 */
export const findDuplicateMovie = async (
  tenPhim: string,
  ngayKhoiChieu: Date,
  excludeMaPhim?: string,
): Promise<Phim | null> => {
  return prisma.phim.findFirst({
    where: {
      TenPhim: tenPhim,
      NgayKhoiChieu: ngayKhoiChieu,
      KhaDung: true,
      ...(excludeMaPhim && {
        MaPhim: { not: excludeMaPhim },
      }),
    },
  });
};

/**
 * Create a new Phim
 */
export const create = async (data: Prisma.PhimCreateInput): Promise<Phim> => {
  return prisma.phim.create({ data });
};

/**
 * Update a Phim record
 */
export const update = async (
  maPhim: string,
  data: Prisma.PhimUpdateInput,
): Promise<Phim> => {
  return prisma.phim.update({
    where: { MaPhim: maPhim },
    data,
  });
};

/**
 * Soft delete a Phim (set KhaDung = false)
 */
export const softDelete = async (maPhim: string): Promise<Phim> => {
  return prisma.phim.update({
    where: { MaPhim: maPhim },
    data: { KhaDung: false },
  });
};

/**
 * Restore a soft-deleted Phim (set KhaDung = true)
 */
export const restore = async (maPhim: string): Promise<Phim> => {
  return prisma.phim.update({
    where: { MaPhim: maPhim },
    data: { KhaDung: true },
  });
};

/**
 * Hard delete a Phim (permanently delete from database)
 */
export const hardDelete = async (maPhim: string): Promise<Phim> => {
  return prisma.phim.delete({
    where: { MaPhim: maPhim },
  });
};

/**
 * Count the number of showtimes associated with a movie
 */
export const countRelatedShowtimes = async (maPhim: string): Promise<number> => {
  return prisma.suatChieu.count({
    where: { MaPhim: maPhim },
  });
};

/**
 * Count related ticket details (ChiTietDatVe) through showtimes and seat showtimes
 */
export const countRelatedTicketDetailsByMovieId = async (
  maPhim: string,
): Promise<number> => {
  return prisma.chiTietDatVe.count({
    where: {
      GheSuatChieu: {
        SuatChieu: {
          MaPhim: maPhim,
        },
      },
    },
  });
};
