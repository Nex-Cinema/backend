import { Role } from '@prisma/client';
import * as staffHoSoRepository from './staffHoSo.repository';
import { UnauthorizedError, NotFoundError, ConflictError, BadRequestError, ForbiddenError } from '../../../utils/errors';
import {
  UpdateStaffProfileInput,
  ChangeStaffPasswordInput,
} from './staffHoSo.validator';
import { comparePassword, hashPassword } from '../../../utils/password';

// ================================================================
// Response shape (never exposes MatKhau or RefreshTokens)
// ================================================================
export interface StaffProfileResponse {
  MaTaiKhoan: string;
  MaNhanVien: string;
  TenDangNhap: string;
  HoTen: string;
  Email: string;
  SoDienThoai: string;
  GioiTinh: boolean | null;
  NgaySinh: Date | null;
  VaiTro: Role;
  KhaDung: boolean;
  ChucVu: string;
  NgayTao: Date;
  NgayCapNhat: Date | null;
}

/**
 * Map a joined NhanVien + TaiKhoan record to the safe response shape
 */
const toProfileResponse = (staff: {
  MaNhanVien: string;
  ChucVu: string;
  TaiKhoan: {
    MaTaiKhoan: string;
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
  };
}): StaffProfileResponse => ({
  MaTaiKhoan: staff.TaiKhoan.MaTaiKhoan,
  MaNhanVien: staff.MaNhanVien,
  TenDangNhap: staff.TaiKhoan.TenDangNhap,
  HoTen: staff.TaiKhoan.HoTen,
  Email: staff.TaiKhoan.Email,
  SoDienThoai: staff.TaiKhoan.SoDienThoai,
  GioiTinh: staff.TaiKhoan.GioiTinh,
  NgaySinh: staff.TaiKhoan.NgaySinh,
  VaiTro: staff.TaiKhoan.VaiTro,
  KhaDung: staff.TaiKhoan.KhaDung,
  ChucVu: staff.ChucVu,
  NgayTao: staff.TaiKhoan.NgayTao,
  NgayCapNhat: staff.TaiKhoan.NgayCapNhat,
});

// ================================================================
// Service functions
// ================================================================

/**
 * GET /api/v1/staff/ho-so
 * Return the authenticated staff member's own profile
 */
export const getStaffProfile = async (
  maTaiKhoan: string,
): Promise<StaffProfileResponse> => {
  const staff = await staffHoSoRepository.findStaffProfileByAccountId(maTaiKhoan);

  if (!staff) {
    throw new ForbiddenError('Tài khoản không phải nhân viên hoặc đã bị khóa.');
  }

  return toProfileResponse(staff);
};

/**
 * PUT /api/v1/staff/ho-so
 * Update the authenticated staff member's own profile
 */
export const updateStaffProfile = async (
  maTaiKhoan: string,
  input: UpdateStaffProfileInput,
): Promise<StaffProfileResponse> => {
  // 1. Verify active staff profile
  const existing = await staffHoSoRepository.findStaffProfileByAccountId(maTaiKhoan);
  if (!existing) {
    throw new ForbiddenError('Tài khoản không phải nhân viên hoặc đã bị khóa.');
  }

  // 2. Duplicate Email check
  if (input.Email && input.Email !== existing.TaiKhoan.Email) {
    const dup = await staffHoSoRepository.findStaffByEmail(input.Email);
    if (dup && dup.MaTaiKhoan !== maTaiKhoan) {
      throw new ConflictError('Email đã được sử dụng');
    }
  }

  // 3. Duplicate SoDienThoai check
  if (input.SoDienThoai && input.SoDienThoai !== existing.TaiKhoan.SoDienThoai) {
    const dup = await staffHoSoRepository.findStaffByPhone(input.SoDienThoai);
    if (dup && dup.MaTaiKhoan !== maTaiKhoan) {
      throw new ConflictError('Số điện thoại đã được sử dụng');
    }
  }

  // 4. Perform update on TaiKhoan (only allowed fields)
  const updated = await staffHoSoRepository.updateStaffProfile(maTaiKhoan, {
    HoTen: input.HoTen,
    Email: input.Email,
    SoDienThoai: input.SoDienThoai,
    GioiTinh: input.GioiTinh,
    NgaySinh: input.NgaySinh,
  });

  // updateStaffProfile returns TaiKhoan with NhanVien
  const nhanVien = updated.NhanVien;
  if (!nhanVien) {
    throw new NotFoundError('Không tìm thấy hồ sơ nhân viên');
  }

  return toProfileResponse({
    MaNhanVien: nhanVien.MaNhanVien,
    ChucVu: nhanVien.ChucVu,
    TaiKhoan: updated,
  });
};

/**
 * PUT /api/v1/staff/doi-mat-khau
 * Change the authenticated staff member's password and revoke refresh tokens
 */
export const changeStaffPassword = async (
  maTaiKhoan: string,
  input: ChangeStaffPasswordInput,
): Promise<void> => {
  // 1. Verify active staff profile and load current password hash
  const staff = await staffHoSoRepository.findStaffProfileByAccountId(maTaiKhoan);
  if (!staff) {
    throw new ForbiddenError('Tài khoản không phải nhân viên hoặc đã bị khóa.');
  }

  // 2. Compare old password
  const isMatch = await comparePassword(input.MatKhauCu, staff.TaiKhoan.MatKhau);
  if (!isMatch) {
    throw new BadRequestError('Mật khẩu cũ không chính xác');
  }

  // 3. Hash new password
  const hashedPassword = await hashPassword(input.MatKhauMoi);

  // 4. Atomically update password + revoke all active refresh tokens
  await staffHoSoRepository.updatePasswordAndRevokeTokens(maTaiKhoan, hashedPassword);
};
