import { Role, Prisma } from '@prisma/client';
import prisma from '../../../config/prisma';

export type TxOrPrisma = Prisma.TransactionClient | typeof prisma;

/**
 * Find active NhanVien + TaiKhoan profile by TaiKhoan ID
 * Returns the full joined record (without MatKhau exposure – caller must strip it)
 */
export const findStaffProfileByAccountId = async (
  maTaiKhoan: string,
  tx: TxOrPrisma = prisma,
) => {
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
 * Find a TaiKhoan by Email (for duplicate check)
 */
export const findStaffByEmail = async (
  email: string,
  tx: TxOrPrisma = prisma,
) => {
  return tx.taiKhoan.findUnique({
    where: { Email: email },
    select: { MaTaiKhoan: true },
  });
};

/**
 * Find a TaiKhoan by SoDienThoai (for duplicate check)
 */
export const findStaffByPhone = async (
  soDienThoai: string,
  tx: TxOrPrisma = prisma,
) => {
  return tx.taiKhoan.findUnique({
    where: { SoDienThoai: soDienThoai },
    select: { MaTaiKhoan: true },
  });
};

/**
 * Update TaiKhoan profile fields for a staff member
 * Returns the updated TaiKhoan joined with NhanVien
 */
export const updateStaffProfile = async (
  maTaiKhoan: string,
  data: Prisma.TaiKhoanUpdateInput,
  tx: TxOrPrisma = prisma,
) => {
  return tx.taiKhoan.update({
    where: { MaTaiKhoan: maTaiKhoan },
    data,
    include: {
      NhanVien: true,
    },
  });
};

/**
 * Update password and revoke all active refresh tokens in a single transaction
 */
export const updatePasswordAndRevokeTokens = async (
  maTaiKhoan: string,
  hashedPassword: string,
) => {
  return prisma.$transaction([
    prisma.taiKhoan.update({
      where: { MaTaiKhoan: maTaiKhoan },
      data: { MatKhau: hashedPassword },
    }),
    prisma.refreshToken.updateMany({
      where: { MaTaiKhoan: maTaiKhoan, BiThuHoi: false },
      data: { BiThuHoi: true },
    }),
  ]);
};
