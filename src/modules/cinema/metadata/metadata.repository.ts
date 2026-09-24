import { LoaiPhong, LoaiGhe, LoaiNgay, Prisma } from '@prisma/client';
import prisma from '../../../config/prisma';

// ==========================================
// 1. LOẠI PHÒNG (Room Type)
// ==========================================

export const findLoaiPhongs = async (): Promise<LoaiPhong[]> => {
  return prisma.loaiPhong.findMany({
    orderBy: { NgayTao: 'desc' },
  });
};

export const findLoaiPhongById = async (maLoaiPhong: string): Promise<LoaiPhong | null> => {
  return prisma.loaiPhong.findUnique({
    where: { MaLoaiPhong: maLoaiPhong },
  });
};

export const createLoaiPhong = async (data: Prisma.LoaiPhongCreateInput): Promise<LoaiPhong> => {
  return prisma.loaiPhong.create({ data });
};

export const updateLoaiPhong = async (
  maLoaiPhong: string,
  data: Prisma.LoaiPhongUpdateInput,
): Promise<LoaiPhong> => {
  return prisma.loaiPhong.update({
    where: { MaLoaiPhong: maLoaiPhong },
    data,
  });
};

export const deleteLoaiPhong = async (maLoaiPhong: string): Promise<LoaiPhong> => {
  return prisma.loaiPhong.delete({
    where: { MaLoaiPhong: maLoaiPhong },
  });
};

export const countRoomsWithLoaiPhong = async (maLoaiPhong: string): Promise<number> => {
  return prisma.phongChieu.count({
    where: { MaLoaiPhong: maLoaiPhong },
  });
};

// ==========================================
// 2. LOẠI GHẾ (Seat Type)
// ==========================================

export const findLoaiGhes = async (): Promise<LoaiGhe[]> => {
  return prisma.loaiGhe.findMany({
    orderBy: { NgayTao: 'desc' },
  });
};

export const findLoaiGheById = async (maLoaiGhe: string): Promise<LoaiGhe | null> => {
  return prisma.loaiGhe.findUnique({
    where: { MaLoaiGhe: maLoaiGhe },
  });
};

export const createLoaiGhe = async (data: Prisma.LoaiGheCreateInput): Promise<LoaiGhe> => {
  return prisma.loaiGhe.create({ data });
};

export const updateLoaiGhe = async (
  maLoaiGhe: string,
  data: Prisma.LoaiGheUpdateInput,
): Promise<LoaiGhe> => {
  return prisma.loaiGhe.update({
    where: { MaLoaiGhe: maLoaiGhe },
    data,
  });
};

export const deleteLoaiGhe = async (maLoaiGhe: string): Promise<LoaiGhe> => {
  return prisma.loaiGhe.delete({
    where: { MaLoaiGhe: maLoaiGhe },
  });
};

export const countSeatsWithLoaiGhe = async (maLoaiGhe: string): Promise<number> => {
  return prisma.ghe.count({
    where: { MaLoaiGhe: maLoaiGhe },
  });
};

// ==========================================
// 3. LOẠI NGÀY (Day Type)
// ==========================================

export const findLoaiNgays = async (): Promise<LoaiNgay[]> => {
  return prisma.loaiNgay.findMany({
    orderBy: { NgayTao: 'desc' },
  });
};

export const findLoaiNgayById = async (maLoaiNgay: string): Promise<LoaiNgay | null> => {
  return prisma.loaiNgay.findUnique({
    where: { MaLoaiNgay: maLoaiNgay },
  });
};

export const createLoaiNgay = async (data: Prisma.LoaiNgayCreateInput): Promise<LoaiNgay> => {
  return prisma.loaiNgay.create({ data });
};

export const updateLoaiNgay = async (
  maLoaiNgay: string,
  data: Prisma.LoaiNgayUpdateInput,
): Promise<LoaiNgay> => {
  return prisma.loaiNgay.update({
    where: { MaLoaiNgay: maLoaiNgay },
    data,
  });
};

export const deleteLoaiNgay = async (maLoaiNgay: string): Promise<LoaiNgay> => {
  return prisma.loaiNgay.delete({
    where: { MaLoaiNgay: maLoaiNgay },
  });
};

export const countShowtimesWithLoaiNgay = async (maLoaiNgay: string): Promise<number> => {
  return prisma.suatChieu.count({
    where: { MaLoaiNgay: maLoaiNgay },
  });
};
