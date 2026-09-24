import { SoDoGhe, Prisma } from '@prisma/client';
import prisma from '../../../config/prisma';

export const findSoDoGhes = async (): Promise<SoDoGhe[]> => {
  return prisma.soDoGhe.findMany({
    orderBy: { NgayTao: 'desc' },
  });
};

export const findSoDoGheById = async (maSoDo: string): Promise<SoDoGhe | null> => {
  return prisma.soDoGhe.findUnique({
    where: { MaSoDo: maSoDo },
  });
};

export const createSoDoGhe = async (data: Prisma.SoDoGheCreateInput): Promise<SoDoGhe> => {
  return prisma.soDoGhe.create({ data });
};

export const updateSoDoGhe = async (
  maSoDo: string,
  data: Prisma.SoDoGheUpdateInput,
): Promise<SoDoGhe> => {
  return prisma.soDoGhe.update({
    where: { MaSoDo: maSoDo },
    data,
  });
};

export const deleteSoDoGhe = async (maSoDo: string): Promise<SoDoGhe> => {
  return prisma.soDoGhe.delete({
    where: { MaSoDo: maSoDo },
  });
};

export const countRoomsWithSoDoGhe = async (maSoDo: string): Promise<number> => {
  return prisma.phongChieu.count({
    where: { MaSoDo: maSoDo },
  });
};
