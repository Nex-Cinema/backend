import { Role, Prisma } from '@prisma/client';
import prisma from '../../../config/prisma';

export type TxOrPrisma = Prisma.TransactionClient | typeof prisma;

/**
 * Find active NhanVien profile by TaiKhoan ID
 */
export const findStaffByAccountId = async (maTaiKhoan: string, tx: TxOrPrisma = prisma) => {
  return tx.nhanVien.findFirst({
    where: {
      MaTaiKhoan: maTaiKhoan,
      KhaDung: true,
      TaiKhoan: {
        KhaDung: true,
        VaiTro: Role.STAFF,
      },
    },
    include: {
      TaiKhoan: true,
    },
  });
};

/**
 * Find active CaLamViec shift template by MaCa
 */
export const findActiveShiftById = async (maCa: string, tx: TxOrPrisma = prisma) => {
  return tx.caLamViec.findFirst({
    where: {
      MaCa: maCa,
      KhaDung: true,
    },
  });
};

/**
 * Find active CaLamViec shift templates paginated
 */
export const findAvailableShiftTemplates = async (
  skip: number,
  take: number,
  tx: TxOrPrisma = prisma,
) => {
  return tx.caLamViec.findMany({
    where: {
      KhaDung: true,
    },
    skip,
    take,
    orderBy: {
      GioBatDau: 'asc',
    },
  });
};

/**
 * Count active CaLamViec shift templates
 */
export const countAvailableShiftTemplates = async (tx: TxOrPrisma = prisma) => {
  return tx.caLamViec.count({
    where: {
      KhaDung: true,
    },
  });
};

/**
 * Count active registrations for a given shift and date
 */
export const countRegistrationsByShiftAndDate = async (
  maCa: string,
  ngayLamViec: Date,
  tx: TxOrPrisma = prisma,
) => {
  return tx.chiTietCaLamViec.count({
    where: {
      MaCa: maCa,
      NgayLamViec: ngayLamViec,
      KhaDung: true,
    },
  });
};

/**
 * Find registrations on a specific date to prevent N+1 query overhead
 */
export const findRegistrationsForDate = async (ngayLamViec: Date, tx: TxOrPrisma = prisma) => {
  return tx.chiTietCaLamViec.findMany({
    where: {
      NgayLamViec: ngayLamViec,
      KhaDung: true,
    },
    select: {
      MaCa: true,
    },
  });
};

/**
 * Find registrations for a specific staff member
 */
export const findStaffSchedules = async (
  maNhanVien: string,
  filters: { tuNgay?: Date; denNgay?: Date },
  skip: number,
  take: number,
  tx: TxOrPrisma = prisma,
) => {
  const where: any = {
    MaNhanVien: maNhanVien,
    KhaDung: true,
  };

  if (filters.tuNgay || filters.denNgay) {
    where.NgayLamViec = {};
    if (filters.tuNgay) {
      where.NgayLamViec.gte = filters.tuNgay;
    }
    if (filters.denNgay) {
      where.NgayLamViec.lte = filters.denNgay;
    }
  }

  return tx.chiTietCaLamViec.findMany({
    where,
    skip,
    take,
    orderBy: [
      { NgayLamViec: 'asc' },
      { CaLamViec: { GioBatDau: 'asc' } },
    ],
    include: {
      CaLamViec: true,
    },
  });
};

/**
 * Count registrations for a specific staff member
 */
export const countStaffSchedules = async (
  maNhanVien: string,
  filters: { tuNgay?: Date; denNgay?: Date },
  tx: TxOrPrisma = prisma,
) => {
  const where: any = {
    MaNhanVien: maNhanVien,
    KhaDung: true,
  };

  if (filters.tuNgay || filters.denNgay) {
    where.NgayLamViec = {};
    if (filters.tuNgay) {
      where.NgayLamViec.gte = filters.tuNgay;
    }
    if (filters.denNgay) {
      where.NgayLamViec.lte = filters.denNgay;
    }
  }

  return tx.chiTietCaLamViec.count({ where });
};

/**
 * Find active registration by MaChiTietCa
 */
export const findActiveRegistrationById = async (maChiTietCa: string, tx: TxOrPrisma = prisma) => {
  return tx.chiTietCaLamViec.findFirst({
    where: {
      MaChiTietCa: maChiTietCa,
      KhaDung: true,
    },
    include: {
      CaLamViec: true,
      NhanVien: true,
    },
  });
};

/**
 * Find duplicate active registration for same staff, shift and date
 */
export const findDuplicateRegistration = async (
  maNhanVien: string,
  maCa: string,
  ngayLamViec: Date,
  tx: TxOrPrisma = prisma,
) => {
  return tx.chiTietCaLamViec.findFirst({
    where: {
      MaNhanVien: maNhanVien,
      MaCa: maCa,
      NgayLamViec: ngayLamViec,
      KhaDung: true,
    },
  });
};

/**
 * Find overlapping active registrations on the same day for a staff member
 */
export const findOverlappingRegistrations = async (
  maNhanVien: string,
  ngayLamViec: Date,
  gioBatDau: Date,
  gioKetThuc: Date,
  tx: TxOrPrisma = prisma,
) => {
  const registrations = await tx.chiTietCaLamViec.findMany({
    where: {
      MaNhanVien: maNhanVien,
      NgayLamViec: ngayLamViec,
      KhaDung: true,
    },
    include: {
      CaLamViec: true,
    },
  });

  const targetStart = gioBatDau.getTime();
  const targetEnd = gioKetThuc.getTime();

  return registrations.find((reg) => {
    const existingStart = reg.CaLamViec.GioBatDau.getTime();
    const existingEnd = reg.CaLamViec.GioKetThuc.getTime();
    return targetStart < existingEnd && targetEnd > existingStart;
  }) || null;
};

/**
 * Create a new shift registration
 */
export const createRegistration = async (
  maNhanVien: string,
  maCa: string,
  ngayLamViec: Date,
  tx: TxOrPrisma = prisma,
) => {
  return tx.chiTietCaLamViec.create({
    data: {
      MaNhanVien: maNhanVien,
      MaCa: maCa,
      NgayLamViec: ngayLamViec,
      KhaDung: true,
    },
  });
};

/**
 * Cancel (soft-delete) shift registration
 */
export const cancelRegistration = async (maChiTietCa: string, tx: TxOrPrisma = prisma) => {
  return tx.chiTietCaLamViec.update({
    where: {
      MaChiTietCa: maChiTietCa,
    },
    data: {
      KhaDung: false,
    },
  });
};
