import { TaiKhoan, Role, Prisma } from '@prisma/client';
import prisma from '../../../config/prisma';

// ========================
// Types
// ========================
export type CreateTaiKhoanData = {
  TenDangNhap: string;
  MatKhau: string;
  HoTen: string;
  Email: string;
  SoDienThoai: string;
  GioiTinh?: boolean;
  NgaySinh?: Date;
  VaiTro: Role;
};

// ========================
// Repository
// ========================

/**
 * Find a TaiKhoan by MaTaiKhoan (primary key)
 */
export const findTaiKhoanById = async (
  maTaiKhoan: string,
): Promise<TaiKhoan | null> => {
  return prisma.taiKhoan.findUnique({
    where: { MaTaiKhoan: maTaiKhoan },
  });
};

/**
 * Find a TaiKhoan by TenDangNhap (username)
 */
export const findTaiKhoanByTenDangNhap = async (
  tenDangNhap: string,
): Promise<TaiKhoan | null> => {
  return prisma.taiKhoan.findUnique({
    where: { TenDangNhap: tenDangNhap },
  });
};

/**
 * Find a TaiKhoan by Email
 */
export const findTaiKhoanByEmail = async (
  email: string,
): Promise<TaiKhoan | null> => {
  return prisma.taiKhoan.findUnique({
    where: { Email: email },
  });
};

/**
 * Create a new TaiKhoan along with optional KhachHang profile
 */
export const createTaiKhoan = async (
  data: CreateTaiKhoanData,
): Promise<TaiKhoan> => {
  return prisma.taiKhoan.create({
    data: {
      ...data,
      // Auto-create KhachHang profile for CUSTOMER role
      ...(data.VaiTro === Role.CUSTOMER && {
        KhachHang: { create: { KhaDung: true } },
      }),
    },
  });
};

/**
 * Update a TaiKhoan record
 */
export const updateTaiKhoan = async (
  maTaiKhoan: string,
  data: Prisma.TaiKhoanUpdateInput,
): Promise<TaiKhoan> => {
  return prisma.taiKhoan.update({
    where: { MaTaiKhoan: maTaiKhoan },
    data,
  });
};

/**
 * Find a TaiKhoan by MaTaiKhoan (alias of findTaiKhoanById)
 */
export const findById = findTaiKhoanById;

/**
 * Find a TaiKhoan with its associated KhachHang profile
 */
export const findCustomerProfileByAccountId = async (
  maTaiKhoan: string,
) => {
  return prisma.taiKhoan.findUnique({
    where: { MaTaiKhoan: maTaiKhoan },
    include: {
      KhachHang: true,
    },
  });
};

/**
 * Find a TaiKhoan by Email (alias of findTaiKhoanByEmail)
 */
export const findByEmail = findTaiKhoanByEmail;

/**
 * Find a TaiKhoan by SoDienThoai
 */
export const findByPhone = async (
  soDienThoai: string,
): Promise<TaiKhoan | null> => {
  return prisma.taiKhoan.findUnique({
    where: { SoDienThoai: soDienThoai },
  });
};

/**
 * Update a TaiKhoan profile and include associated KhachHang profile
 */
export const updateProfile = async (
  maTaiKhoan: string,
  data: Prisma.TaiKhoanUpdateInput,
) => {
  return prisma.taiKhoan.update({
    where: { MaTaiKhoan: maTaiKhoan },
    data,
    include: {
      KhachHang: true,
    },
  });
};

/**
 * Update TaiKhoan password
 */
export const updatePassword = async (
  maTaiKhoan: string,
  hashedPassword: string,
) => {
  return prisma.taiKhoan.update({
    where: { MaTaiKhoan: maTaiKhoan },
    data: { MatKhau: hashedPassword },
  });
};

/**
 * Revoke all refresh tokens for a TaiKhoan
 */
export const revokeRefreshTokensByAccountId = async (
  maTaiKhoan: string,
) => {
  return prisma.refreshToken.updateMany({
    where: { MaTaiKhoan: maTaiKhoan, BiThuHoi: false },
    data: { BiThuHoi: true },
  });
};

/**
 * Update password and revoke refresh tokens in a single transaction
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
