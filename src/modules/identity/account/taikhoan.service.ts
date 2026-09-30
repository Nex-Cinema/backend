import { Role } from '@prisma/client';
import {
  findCustomerProfileByAccountId,
  findByEmail,
  findByPhone,
  updateProfile,
  updatePasswordAndRevokeTokens,
} from './taikhoan.repository';
import { UnauthorizedError, NotFoundError, ConflictError, BadRequestError } from '../../../utils/errors';
import { UpdateProfileInput, ChangePasswordInput } from './taikhoan.validator';
import { comparePassword, hashPassword } from '../../../utils/password';

export interface CustomerProfileResponse {
  MaTaiKhoan: string;
  MaKhachHang?: string;
  TenDangNhap: string;
  HoTen: string;
  Email: string;
  SoDienThoai: string;
  GioiTinh: boolean | null;
  NgaySinh: Date | null;
  VaiTro: Role;
  KhaDung: boolean;
  NgayTao: Date;
  NgayCapNhat: Date | null;
}

/**
 * Get profile of current logged-in customer
 */
export const getCurrentCustomerProfile = async (
  maTaiKhoan: string,
): Promise<CustomerProfileResponse> => {
  const taiKhoan = await findCustomerProfileByAccountId(maTaiKhoan);

  if (!taiKhoan) {
    throw new NotFoundError('Không tìm thấy tài khoản');
  }

  // Active account check
  if (!taiKhoan.KhaDung || (taiKhoan.KhachHang && !taiKhoan.KhachHang.KhaDung)) {
    throw new UnauthorizedError('Tài khoản đã bị vô hiệu hóa');
  }

  return {
    MaTaiKhoan: taiKhoan.MaTaiKhoan,
    MaKhachHang: taiKhoan.KhachHang?.MaKhachHang,
    TenDangNhap: taiKhoan.TenDangNhap,
    HoTen: taiKhoan.HoTen,
    Email: taiKhoan.Email,
    SoDienThoai: taiKhoan.SoDienThoai,
    GioiTinh: taiKhoan.GioiTinh,
    NgaySinh: taiKhoan.NgaySinh,
    VaiTro: taiKhoan.VaiTro,
    KhaDung: taiKhoan.KhaDung,
    NgayTao: taiKhoan.NgayTao,
    NgayCapNhat: taiKhoan.NgayCapNhat,
  };
};

/**
 * Update current customer's profile details
 */
export const updateCurrentCustomerProfile = async (
  maTaiKhoan: string,
  input: UpdateProfileInput,
): Promise<CustomerProfileResponse> => {
  const existing = await findCustomerProfileByAccountId(maTaiKhoan);

  if (!existing) {
    throw new NotFoundError('Không tìm thấy tài khoản');
  }

  // Active account check
  if (!existing.KhaDung || (existing.KhachHang && !existing.KhachHang.KhaDung)) {
    throw new UnauthorizedError('Tài khoản đã bị vô hiệu hóa');
  }

  // Duplicate email check
  if (input.Email && input.Email !== existing.Email) {
    const duplicateEmail = await findByEmail(input.Email);
    if (duplicateEmail && duplicateEmail.MaTaiKhoan !== maTaiKhoan) {
      throw new ConflictError('Email đã được sử dụng');
    }
  }

  // Duplicate phone check
  if (input.SoDienThoai && input.SoDienThoai !== existing.SoDienThoai) {
    const duplicatePhone = await findByPhone(input.SoDienThoai);
    if (duplicatePhone && duplicatePhone.MaTaiKhoan !== maTaiKhoan) {
      throw new ConflictError('Số điện thoại đã được sử dụng');
    }
  }

  // Perform update
  const updated = await updateProfile(maTaiKhoan, {
    HoTen: input.HoTen,
    Email: input.Email,
    SoDienThoai: input.SoDienThoai,
    GioiTinh: input.GioiTinh,
    NgaySinh: input.NgaySinh,
  });

  return {
    MaTaiKhoan: updated.MaTaiKhoan,
    MaKhachHang: updated.KhachHang?.MaKhachHang,
    TenDangNhap: updated.TenDangNhap,
    HoTen: updated.HoTen,
    Email: updated.Email,
    SoDienThoai: updated.SoDienThoai,
    GioiTinh: updated.GioiTinh,
    NgaySinh: updated.NgaySinh,
    VaiTro: updated.VaiTro,
    KhaDung: updated.KhaDung,
    NgayTao: updated.NgayTao,
    NgayCapNhat: updated.NgayCapNhat,
  };
};

/**
 * Change current customer's password and revoke active refresh tokens
 */
export const changeCurrentCustomerPassword = async (
  maTaiKhoan: string,
  input: ChangePasswordInput,
): Promise<void> => {
  const existing = await findCustomerProfileByAccountId(maTaiKhoan);

  if (!existing) {
    throw new NotFoundError('Không tìm thấy tài khoản');
  }

  // Active account check
  if (!existing.KhaDung || (existing.KhachHang && !existing.KhachHang.KhaDung)) {
    throw new UnauthorizedError('Tài khoản đã bị vô hiệu hóa');
  }

  // Verify MatKhauCu using bcrypt
  const isMatch = await comparePassword(input.MatKhauCu, existing.MatKhau);
  if (!isMatch) {
    throw new BadRequestError('Mật khẩu cũ không chính xác');
  }

  // Hash MatKhauMoi
  const hashedPassword = await hashPassword(input.MatKhauMoi);

  // Update in a transaction (both password and refresh tokens revocation)
  await updatePasswordAndRevokeTokens(maTaiKhoan, hashedPassword);
};
