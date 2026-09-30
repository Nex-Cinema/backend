import { Role, TaiKhoan } from '@prisma/client';
import prisma from '../../../config/prisma';
import { hashPassword } from '../../../utils/password';
import {
  CreateUserInput,
  UpdateUserInput,
  AdminChangePasswordInput,
  UserQueryInput,
} from './user.validator';
import { NotFoundError, ConflictError, BadRequestError } from '../../../utils/errors';

export type SanitizedUser = Omit<TaiKhoan, 'MatKhau'> & {
  KhachHang?: any;
};

const sanitizeUser = (user: any): SanitizedUser => {
  const { MatKhau, ...sanitized } = user;
  return sanitized;
};

export const getDanhSachNguoiDung = async (
  query: UserQueryInput,
): Promise<{
  items: SanitizedUser[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const { page, limit, vaiTro, khaDung, search } = query;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (vaiTro) {
    where.VaiTro = vaiTro;
  }

  if (khaDung !== undefined) {
    where.KhaDung = khaDung;
  }

  if (search) {
    where.OR = [
      { TenDangNhap: { contains: search } },
      { HoTen: { contains: search } },
      { Email: { contains: search } },
      { SoDienThoai: { contains: search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.taiKhoan.findMany({
      where,
      include: {
        KhachHang: true,
      },
      orderBy: { NgayTao: 'desc' },
      skip,
      take: limit,
    }),
    prisma.taiKhoan.count({ where }),
  ]);

  const sanitizedItems = items.map(sanitizeUser);
  const totalPages = Math.ceil(total / limit);

  return {
    items: sanitizedItems,
    page,
    limit,
    total,
    totalPages,
  };
};

export const getChiTietNguoiDung = async (maTaiKhoan: string): Promise<SanitizedUser> => {
  const user = await prisma.taiKhoan.findUnique({
    where: { MaTaiKhoan: maTaiKhoan },
    include: {
      KhachHang: true,
    },
  });

  if (!user) {
    throw new NotFoundError('Không tìm thấy tài khoản người dùng');
  }

  return sanitizeUser(user);
};

export const taoNguoiDung = async (input: CreateUserInput): Promise<SanitizedUser> => {
  // Check duplicates
  const [dupUsername, dupEmail, dupPhone] = await Promise.all([
    prisma.taiKhoan.findUnique({ where: { TenDangNhap: input.TenDangNhap } }),
    prisma.taiKhoan.findUnique({ where: { Email: input.Email } }),
    prisma.taiKhoan.findUnique({ where: { SoDienThoai: input.SoDienThoai } }),
  ]);

  if (dupUsername) throw new ConflictError('Tên đăng nhập đã tồn tại');
  if (dupEmail) throw new ConflictError('Email đã được sử dụng');
  if (dupPhone) throw new ConflictError('Số điện thoại đã được sử dụng');

  const hashedPassword = await hashPassword(input.MatKhau);

  const newUser = await prisma.$transaction(async (tx) => {
    return tx.taiKhoan.create({
      data: {
        TenDangNhap: input.TenDangNhap,
        MatKhau: hashedPassword,
        HoTen: input.HoTen,
        Email: input.Email,
        SoDienThoai: input.SoDienThoai,
        GioiTinh: input.GioiTinh,
        NgaySinh: input.NgaySinh,
        VaiTro: input.VaiTro,
        KhaDung: true,
        ...(input.VaiTro === Role.CUSTOMER && {
          KhachHang: { create: { KhaDung: true } },
        }),
      },
      include: {
        KhachHang: true,
      },
    });
  });

  return sanitizeUser(newUser);
};

export const capNhatNguoiDung = async (
  maTaiKhoan: string,
  input: UpdateUserInput,
): Promise<SanitizedUser> => {
  const user = await prisma.taiKhoan.findUnique({
    where: { MaTaiKhoan: maTaiKhoan },
  });

  if (!user) {
    throw new NotFoundError('Không tìm thấy tài khoản');
  }

  // Check unique constraints
  if (input.Email && input.Email !== user.Email) {
    const dupEmail = await prisma.taiKhoan.findUnique({ where: { Email: input.Email } });
    if (dupEmail) throw new ConflictError('Email đã được sử dụng');
  }

  if (input.SoDienThoai && input.SoDienThoai !== user.SoDienThoai) {
    const dupPhone = await prisma.taiKhoan.findUnique({ where: { SoDienThoai: input.SoDienThoai } });
    if (dupPhone) throw new ConflictError('Số điện thoại đã được sử dụng');
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    // Update main TaiKhoan
    const updated = await tx.taiKhoan.update({
      where: { MaTaiKhoan: maTaiKhoan },
      data: {
        HoTen: input.HoTen,
        Email: input.Email,
        SoDienThoai: input.SoDienThoai,
        GioiTinh: input.GioiTinh,
        NgaySinh: input.NgaySinh,
        KhaDung: input.KhaDung,
      },
      include: {
        KhachHang: true,
      },
    });

    // Return latest model state
    return tx.taiKhoan.findUnique({
      where: { MaTaiKhoan: maTaiKhoan },
      include: {
        KhachHang: true,
      },
    });
  });

  return sanitizeUser(updatedUser);
};

export const adminDoiMatKhau = async (
  maTaiKhoan: string,
  input: AdminChangePasswordInput,
): Promise<void> => {
  const user = await prisma.taiKhoan.findUnique({ where: { MaTaiKhoan: maTaiKhoan } });
  if (!user) {
    throw new NotFoundError('Không tìm thấy tài khoản');
  }

  const hashedPassword = await hashPassword(input.MatKhau);

  await prisma.taiKhoan.update({
    where: { MaTaiKhoan: maTaiKhoan },
    data: { MatKhau: hashedPassword },
  });
};

export const xoaNguoiDung = async (
  maTaiKhoan: string,
): Promise<{ action: 'soft' | 'hard'; data: SanitizedUser | null }> => {
  const user = await prisma.taiKhoan.findUnique({
    where: { MaTaiKhoan: maTaiKhoan },
    include: {
      KhachHang: true,
    },
  });

  if (!user) {
    throw new NotFoundError('Không tìm thấy tài khoản');
  }

  let dependencyCount = 0;

  if (user.VaiTro === Role.CUSTOMER && user.KhachHang) {
    const maKhachHang = user.KhachHang.MaKhachHang;
    const [bookingsCount, reviewsCount] = await Promise.all([
      prisma.phieuDatVe.count({ where: { MaKhachHang: maKhachHang } }),
      prisma.danhGia.count({ where: { MaKhachHang: maKhachHang } }),
    ]);
    dependencyCount = bookingsCount + reviewsCount;
  }

  if (dependencyCount > 0) {
    // Soft delete account & profiles
    const updated = await prisma.$transaction(async (tx) => {
      if (user.KhachHang) {
        await tx.khachHang.update({
          where: { MaKhachHang: user.KhachHang.MaKhachHang },
          data: { KhaDung: false },
        });
      }
      return tx.taiKhoan.update({
        where: { MaTaiKhoan: maTaiKhoan },
        data: { KhaDung: false },
        include: {
          KhachHang: true,
        },
      });
    });
    return { action: 'soft', data: sanitizeUser(updated) };
  }

  // Hard delete
  await prisma.$transaction(async (tx) => {
    // Revoke refresh tokens first
    await tx.refreshToken.deleteMany({ where: { MaTaiKhoan: maTaiKhoan } });

    if (user.KhachHang) {
      await tx.khachHang.delete({ where: { MaKhachHang: user.KhachHang.MaKhachHang } });
    }
    await tx.taiKhoan.delete({ where: { MaTaiKhoan: maTaiKhoan } });
  });

  return { action: 'hard', data: null };
};
