import { PhongChieu, Ghe, SoDoGhe, LoaiGhe, Prisma } from '@prisma/client';
import prisma from '../../../config/prisma';

/**
 * Get all screening rooms with their associated Room Type and Seat Map metadata
 */
export const findPhongChieus = async (): Promise<(PhongChieu & { loaiPhong: string; soDoGhe: string; soHang: number; soCot: number })[]> => {
  const rooms = await prisma.phongChieu.findMany({
    include: {
      LoaiPhong: true,
      SoDoGhe: true,
    },
    orderBy: { NgayTao: 'desc' },
  });

  return rooms.map((room) => ({
    ...room,
    loaiPhong: room.LoaiPhong.TenLoaiPhong,
    soDoGhe: room.SoDoGhe.TenSoDo,
    soHang: room.SoDoGhe.SoHang,
    soCot: room.SoDoGhe.SoCot,
  }));
};

/**
 * Get a single screening room by ID with relations loaded
 */
export const findPhongChieuById = async (maPhong: string): Promise<PhongChieu | null> => {
  return prisma.phongChieu.findUnique({
    where: { MaPhong: maPhong },
    include: {
      LoaiPhong: true,
      SoDoGhe: true,
    },
  });
};

/**
 * Create a new screening room
 */
export const createPhongChieu = async (data: Prisma.PhongChieuUncheckedCreateInput): Promise<PhongChieu> => {
  return prisma.phongChieu.create({ data });
};

/**
 * Update an existing screening room
 */
export const updatePhongChieu = async (
  maPhong: string,
  data: Prisma.PhongChieuUncheckedUpdateInput,
): Promise<PhongChieu> => {
  return prisma.phongChieu.update({
    where: { MaPhong: maPhong },
    data,
  });
};

/**
 * Permanently delete a screening room record (used as part of transactions)
 */
export const deletePhongChieu = async (maPhong: string): Promise<PhongChieu> => {
  return prisma.phongChieu.delete({
    where: { MaPhong: maPhong },
  });
};

/**
 * Check if a room name already exists, excluding a specific room ID when updating
 */
export const findDuplicateRoomName = async (
  tenPhong: string,
  excludeMaPhong?: string,
): Promise<PhongChieu | null> => {
  return prisma.phongChieu.findFirst({
    where: {
      TenPhong: tenPhong,
      KhaDung: true,
      ...(excludeMaPhong && {
        MaPhong: { not: excludeMaPhong },
      }),
    },
  });
};

// ==========================================
// Seat Map & Seat Queries
// ==========================================

/**
 * Find seat template map by ID
 */
export const findSoDoGheById = async (maSoDo: string): Promise<SoDoGhe | null> => {
  return prisma.soDoGhe.findUnique({
    where: { MaSoDo: maSoDo },
  });
};

/**
 * Get all seat templates
 */
export const findSoDoGhes = async (): Promise<SoDoGhe[]> => {
  return prisma.soDoGhe.findMany({
    where: { KhaDung: true },
    orderBy: { NgayTao: 'desc' },
  });
};

/**
 * Find seat type by name (case-insensitive contains match)
 */
export const findLoaiGheByTen = async (tenLoaiGhe: string): Promise<LoaiGhe | null> => {
  return prisma.loaiGhe.findFirst({
    where: {
      TenLoaiGhe: {
        contains: tenLoaiGhe,
      },
    },
  });
};

/**
 * Fallback to retrieve the first available active seat type
 */
export const findFirstLoaiGhe = async (): Promise<LoaiGhe | null> => {
  return prisma.loaiGhe.findFirst({
    where: { KhaDung: true },
    orderBy: { PhuThu: 'asc' },
  });
};

/**
 * Get all seats in a screening room, ordered by row and column
 */
export const findGhesByPhong = async (maPhong: string): Promise<Ghe[]> => {
  return prisma.ghe.findMany({
    where: { MaPhong: maPhong },
    orderBy: [
      { ViTriDay: 'asc' },
      { ViTriCot: 'asc' },
    ],
  });
};

/**
 * Create multiple seats at once
 */
export const createGhes = async (data: Prisma.GheUncheckedCreateInput[]): Promise<Prisma.BatchPayload> => {
  return prisma.ghe.createMany({ data });
};

// ==========================================
// Deletion & Constraints Queries
// ==========================================

/**
 * Count total tickets sold for a specific screening room
 */
export const countRelatedTickets = async (maPhong: string): Promise<number> => {
  return prisma.chiTietDatVe.count({
    where: {
      GheSuatChieu: {
        SuatChieu: {
          MaPhong: maPhong,
        },
      },
    },
  });
};

/**
 * Find all showtimes associated with a screening room
 */
export const findShowtimesByRoom = async (maPhong: string) => {
  return prisma.suatChieu.findMany({
    where: { MaPhong: maPhong },
    select: { MaSuatChieu: true },
  });
};
