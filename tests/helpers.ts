import { PrismaClient, Role, GioiHanTuoi, TrangThaiGheSuatChieu, TrangThaiPhieuDatVe } from '@prisma/client';
import bcrypt from 'bcrypt';
import request from 'supertest';
import prisma from '../src/config/prisma';

const BCRYPT_SALT_ROUNDS = 4; // Faster for testing

/**
 * Clean up all tables in correct dependency order
 */
export const cleanupTestData = async () => {
  // Delete in reverse order of foreign key dependency
  await prisma.cauHinhVanHanh.deleteMany({});
  await prisma.chiTietCaLamViec.deleteMany({});
  await prisma.caLamViec.deleteMany({});
  await prisma.lichSuHoanTien.deleteMany({});
  await prisma.giaoDich.deleteMany({});
  await prisma.chiTietDatVe.deleteMany({});
  await prisma.phieuDatVe.deleteMany({});
  await prisma.gheSuatChieu.deleteMany({});
  await prisma.suatChieu.deleteMany({});
  await prisma.danhGia.deleteMany({});
  await prisma.phim.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.khachHang.deleteMany({});
  await prisma.nhanVien.deleteMany({});
  await prisma.taiKhoan.deleteMany({});
  await prisma.ghe.deleteMany({});
  await prisma.phongChieu.deleteMany({});
  await prisma.loaiGhe.deleteMany({});
  await prisma.loaiPhong.deleteMany({});
  await prisma.soDoGhe.deleteMany({});
  await prisma.loaiNgay.deleteMany({});
};

/**
 * Helper to hash password for test seed accounts
 */
const hashTestPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

/**
 * Create a test Admin account
 */
export const createTestAdmin = async (username = 'test_admin', password = 'password123') => {
  const hashedPassword = await hashTestPassword(password);
  const randomPhone = '099' + Math.floor(1000000 + Math.random() * 9000000).toString();
  return prisma.taiKhoan.create({
    data: {
      TenDangNhap: username,
      MatKhau: hashedPassword,
      HoTen: 'Test Admin',
      Email: `${username}@test.com`,
      SoDienThoai: randomPhone,
      VaiTro: Role.ADMIN,
      KhaDung: true,
      NhanVien: {
        create: {
          ChucVu: 'Test Admin Manager',
          KhaDung: true,
        },
      },
    },
  });
};

/**
 * Create a test Staff account
 */
export const createTestStaff = async (username = 'test_staff', password = 'password123') => {
  const hashedPassword = await hashTestPassword(password);
  const randomPhone = '099' + Math.floor(1000000 + Math.random() * 9000000).toString();
  return prisma.taiKhoan.create({
    data: {
      TenDangNhap: username,
      MatKhau: hashedPassword,
      HoTen: 'Test Staff',
      Email: `${username}@test.com`,
      SoDienThoai: randomPhone,
      VaiTro: Role.STAFF,
      KhaDung: true,
      NhanVien: {
        create: {
          ChucVu: 'Test Staff Ticket Seller',
          KhaDung: true,
        },
      },
    },
  });
};

/**
 * Create a test Customer account
 */
export const createTestCustomer = async (username = 'test_customer', password = 'password123') => {
  const hashedPassword = await hashTestPassword(password);
  const randomPhone = '099' + Math.floor(1000000 + Math.random() * 9000000).toString();
  return prisma.taiKhoan.create({
    data: {
      TenDangNhap: username,
      MatKhau: hashedPassword,
      HoTen: 'Test Customer',
      Email: `${username}@test.com`,
      SoDienThoai: randomPhone,
      VaiTro: Role.CUSTOMER,
      KhaDung: true,
      KhachHang: {
        create: {
          KhaDung: true,
        },
      },
    },
  });
};

/**
 * Log in and retrieve the Access Token using Supertest
 */
export const loginAndGetToken = async (app: any, username: string, password = 'password123'): Promise<string> => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({
      TenDangNhap: username,
      MatKhau: password,
    });
  
  if (!res.body.success) {
    throw new Error(`Login failed for user ${username}: ${res.body.message}`);
  }

  return res.body.data.tokens.accessToken;
};

/**
 * Create a test Movie
 */
export const createTestMovie = async (data?: Partial<any>) => {
  return prisma.phim.create({
    data: {
      TenPhim: data?.TenPhim || 'Test Movie Name',
      ThoiLuong: data?.ThoiLuong || 120,
      TheLoai: data?.TheLoai || 'Action',
      NgayKhoiChieu: data?.NgayKhoiChieu || new Date('2026-06-01'),
      NgayKetThuc: data?.NgayKetThuc !== undefined ? data.NgayKetThuc : new Date('2026-07-01'),
      GioiHanTuoi: data?.GioiHanTuoi || GioiHanTuoi.P,
      Trailer: data?.Trailer || 'https://youtube.com/trailer',
      KhaDung: data?.KhaDung !== undefined ? data.KhaDung : true,
      DaoDien: data?.DaoDien || 'Test Director',
      DienVien: data?.DienVien || 'Actor 1, Actor 2',
      NoiDung: data?.NoiDung || 'A movie about testing code.',
      HinhAnh: data?.HinhAnh || 'https://test.com/image.jpg',
    },
  });
};

/**
 * Create a related ticket detail to test hard delete blocking business rule
 * PHIM -> SUATCHIEU -> GHE_SUATCHIEU -> CHITIETDATVE
 */
export const createTicketDetailForMovie = async (maPhim: string) => {
  // 1. Create SoDoGhe
  const soDoGhe = await prisma.soDoGhe.create({
    data: { TenSoDo: 'Test Sơ đồ', SoHang: 5, SoCot: 5 },
  });

  // 2. Create LoaiPhong
  const loaiPhong = await prisma.loaiPhong.create({
    data: { TenLoaiPhong: 'Test Loại Phòng', PhuThu: 0.0 },
  });

  // 3. Create PhongChieu
  const phongChieu = await prisma.phongChieu.create({
    data: { TenPhong: 'Test Phòng', MaLoaiPhong: loaiPhong.MaLoaiPhong, MaSoDo: soDoGhe.MaSoDo },
  });

  // 4. Create LoaiGhe
  const loaiGhe = await prisma.loaiGhe.create({
    data: { TenLoaiGhe: 'Test Loại Ghế', PhuThu: 0.0 },
  });

  // 5. Create Ghe
  const ghe = await prisma.ghe.create({
    data: { ViTriDay: 'A', ViTriCot: 1, MaPhong: phongChieu.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
  });

  // 6. Create LoaiNgay
  const loaiNgay = await prisma.loaiNgay.create({
    data: { TenLoaiNgay: 'Test Loại Ngày', PhuThu: 0.0 },
  });

  // 7. Create SuatChieu
  const suatChieu = await prisma.suatChieu.create({
    data: {
      MaPhim: maPhim,
      MaPhong: phongChieu.MaPhong,
      MaLoaiNgay: loaiNgay.MaLoaiNgay,
      NgayChieu: new Date('2026-06-15'),
      GioChieu: new Date('2026-06-15T18:00:00Z'),
      GiaVeGoc: 50000.0,
    },
  });

  // 8. Create GheSuatChieu
  const gheSuatChieu = await prisma.gheSuatChieu.create({
    data: {
      MaSuatChieu: suatChieu.MaSuatChieu,
      MaGhe: ghe.MaGhe,
      TrangThai: TrangThaiGheSuatChieu.DA_DAT,
      GiaVe: 50000.0,
    },
  });

  // 9. Create PhieuDatVe
  const phieuDatVe = await prisma.phieuDatVe.create({
    data: {
      TongTien: 50000.0,
      TrangThai: TrangThaiPhieuDatVe.DA_THANH_TOAN,
    },
  });

  // 10. Create ChiTietDatVe
  const chiTietDatVe = await prisma.chiTietDatVe.create({
    data: {
      MaPhieuDat: phieuDatVe.MaPhieuDat,
      MaGheSuatChieu: gheSuatChieu.MaGheSuatChieu,
      GiaVe: 50000.0,
    },
  });

  return chiTietDatVe;
};
