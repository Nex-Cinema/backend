import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import {
  cleanupTestData,
  createTestAdmin,
  createTestCustomer,
  loginAndGetToken,
  createTestMovie,
} from '../helpers';
import { TrangThaiGheSuatChieu, TrangThaiPhieuDatVe, TrangThaiGiaoDich, PhuongThucThanhToan } from '@prisma/client';

describe('📊 Thống kê Báo cáo (Admin) Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    await cleanupTestData();

    // Create test accounts
    await createTestAdmin('admin_stats', 'password123');
    await createTestCustomer('customer_stats', 'password123');

    // Login and get tokens
    adminToken = await loginAndGetToken(app, 'admin_stats', 'password123');
    customerToken = await loginAndGetToken(app, 'customer_stats', 'password123');
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up transaction and booking records but preserve users
    await prisma.lichSuHoanTien.deleteMany({});
    await prisma.giaoDich.deleteMany({});
    await prisma.chiTietDatVe.deleteMany({});
    await prisma.phieuDatVe.deleteMany({});
    await prisma.gheSuatChieu.deleteMany({});
    await prisma.suatChieu.deleteMany({});
    await prisma.danhGia.deleteMany({});
    await prisma.phim.deleteMany({});
    await prisma.ghe.deleteMany({});
    await prisma.phongChieu.deleteMany({});
    await prisma.loaiGhe.deleteMany({});
    await prisma.loaiPhong.deleteMany({});
    await prisma.soDoGhe.deleteMany({});
    await prisma.loaiNgay.deleteMany({});
  });

  describe('🔑 Authorization', () => {
    it('should block non-admin users from accessing revenue stats', async () => {
      const res = await request(app)
        .get('/api/v1/admin/thong-ke/doanh-thu')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should block non-admin users from accessing seat fill rate stats', async () => {
      const res = await request(app)
        .get('/api/v1/admin/thong-ke/ti-le-ghe')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('📈 Stats Calculation and Filters', () => {
    it('should return correct revenue stats and filter results', async () => {
      // 1. Create a movie
      const movie1 = await createTestMovie({ TenPhim: 'Movie Stats 1' });
      const movie2 = await createTestMovie({ TenPhim: 'Movie Stats 2' });

      // 2. Create room & seat structures
      const soDo = await prisma.soDoGhe.create({
        data: { TenSoDo: 'Room 5x5', SoHang: 5, SoCot: 5 },
      });
      const loaiPhong = await prisma.loaiPhong.create({
        data: { TenLoaiPhong: 'Room Type Standard', PhuThu: 0 },
      });
      const phong = await prisma.phongChieu.create({
        data: { TenPhong: 'Room 101', MaLoaiPhong: loaiPhong.MaLoaiPhong, MaSoDo: soDo.MaSoDo },
      });
      const loaiGhe = await prisma.loaiGhe.create({
        data: { TenLoaiGhe: 'Seat Type Standard', PhuThu: 0 },
      });

      const seat1 = await prisma.ghe.create({
        data: { ViTriDay: 'A', ViTriCot: 1, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
      });
      const seat2 = await prisma.ghe.create({
        data: { ViTriDay: 'A', ViTriCot: 2, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
      });

      const loaiNgay = await prisma.loaiNgay.create({
        data: { TenLoaiNgay: 'Weekday Stats', PhuThu: 0 },
      });

      // 3. Create showtimes
      const showtime1 = await prisma.suatChieu.create({
        data: {
          MaPhim: movie1.MaPhim,
          MaPhong: phong.MaPhong,
          MaLoaiNgay: loaiNgay.MaLoaiNgay,
          NgayChieu: new Date('2026-06-10'),
          GioChieu: new Date('2026-06-10T18:00:00Z'),
          GiaVeGoc: 50000,
        },
      });

      const showtime2 = await prisma.suatChieu.create({
        data: {
          MaPhim: movie2.MaPhim,
          MaPhong: phong.MaPhong,
          MaLoaiNgay: loaiNgay.MaLoaiNgay,
          NgayChieu: new Date('2026-06-15'),
          GioChieu: new Date('2026-06-15T20:00:00Z'),
          GiaVeGoc: 60000,
        },
      });

      // 4. Create seats for showtimes
      const gsc1 = await prisma.gheSuatChieu.create({
        data: {
          MaSuatChieu: showtime1.MaSuatChieu,
          MaGhe: seat1.MaGhe,
          TrangThai: TrangThaiGheSuatChieu.DA_DAT,
          GiaVe: 50000,
        },
      });

      const gsc2 = await prisma.gheSuatChieu.create({
        data: {
          MaSuatChieu: showtime2.MaSuatChieu,
          MaGhe: seat2.MaGhe,
          TrangThai: TrangThaiGheSuatChieu.DA_DAT,
          GiaVe: 60000,
        },
      });

      // 5. Create valid paid bookings
      const customer = await prisma.khachHang.findFirstOrThrow();
      const bill1 = await prisma.phieuDatVe.create({
        data: {
          MaKhachHang: customer.MaKhachHang,
          TongTien: 50000,
          TrangThai: TrangThaiPhieuDatVe.DA_THANH_TOAN,
        },
      });
      await prisma.chiTietDatVe.create({
        data: {
          MaPhieuDat: bill1.MaPhieuDat,
          MaGheSuatChieu: gsc1.MaGheSuatChieu,
          GiaVe: 50000,
        },
      });
      await prisma.giaoDich.create({
        data: {
          MaPhieuDat: bill1.MaPhieuDat,
          PhuongThuc: PhuongThucThanhToan.MOMO,
          SoTien: 50000,
          TrangThai: TrangThaiGiaoDich.THANH_CONG,
          NgayGiaoDich: new Date('2026-06-10T18:05:00Z'),
        },
      });

      const bill2 = await prisma.phieuDatVe.create({
        data: {
          MaKhachHang: customer.MaKhachHang,
          TongTien: 60000,
          TrangThai: TrangThaiPhieuDatVe.DA_THANH_TOAN,
        },
      });
      await prisma.chiTietDatVe.create({
        data: {
          MaPhieuDat: bill2.MaPhieuDat,
          MaGheSuatChieu: gsc2.MaGheSuatChieu,
          GiaVe: 60000,
        },
      });
      await prisma.giaoDich.create({
        data: {
          MaPhieuDat: bill2.MaPhieuDat,
          PhuongThuc: PhuongThucThanhToan.VNPAY,
          SoTien: 60000,
          TrangThai: TrangThaiGiaoDich.THANH_CONG,
          NgayGiaoDich: new Date('2026-06-15T20:10:00Z'),
        },
      });

      // 6. Test statistics API without filters
      const resAll = await request(app)
        .get('/api/v1/admin/thong-ke/doanh-thu')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resAll.status).toBe(200);
      expect(resAll.body.success).toBe(true);
      expect(Number(resAll.body.data.TongDoanhThu)).toBe(110000);
      expect(resAll.body.data.DoanhThuTheoPhim.length).toBe(2);
      expect(resAll.body.data.DoanhThuTheoPhuongThuc.length).toBe(2);

      // Verify movie stats mapping
      const m1Stat = resAll.body.data.DoanhThuTheoPhim.find((p: any) => p.MaPhim === movie1.MaPhim);
      expect(m1Stat).toBeDefined();
      expect(m1Stat.TenPhim).toBe('Movie Stats 1');
      expect(Number(m1Stat.DoanhThu)).toBe(50000);
      expect(m1Stat.SoVeBanRa).toBe(1);

      // 7. Test query filter by Date Range
      const resDateFilter = await request(app)
        .get('/api/v1/admin/thong-ke/doanh-thu')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          tuNgay: '2026-06-01',
          denNgay: '2026-06-12',
        });

      expect(resDateFilter.status).toBe(200);
      expect(Number(resDateFilter.body.data.TongDoanhThu)).toBe(50000);
      expect(resDateFilter.body.data.DoanhThuTheoPhim.length).toBe(1);
      expect(resDateFilter.body.data.DoanhThuTheoPhim[0].MaPhim).toBe(movie1.MaPhim);

      // 8. Test query filter by Movie ID
      const resMovieFilter = await request(app)
        .get('/api/v1/admin/thong-ke/doanh-thu')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          maPhim: movie2.MaPhim,
        });

      expect(resMovieFilter.status).toBe(200);
      expect(Number(resMovieFilter.body.data.TongDoanhThu)).toBe(60000);
      expect(resMovieFilter.body.data.DoanhThuTheoPhim.length).toBe(1);
      expect(resMovieFilter.body.data.DoanhThuTheoPhim[0].MaPhim).toBe(movie2.MaPhim);
    });

    it('should return correct seat fill rate stats', async () => {
      // 1. Create data structures
      const movie = await createTestMovie({ TenPhim: 'Movie Fill Rate' });
      const soDo = await prisma.soDoGhe.create({
        data: { TenSoDo: 'Room 2x2', SoHang: 2, SoCot: 2 },
      });
      const loaiPhong = await prisma.loaiPhong.create({
        data: { TenLoaiPhong: 'Room Standard', PhuThu: 0 },
      });
      const phong = await prisma.phongChieu.create({
        data: { TenPhong: 'Room 102', MaLoaiPhong: loaiPhong.MaLoaiPhong, MaSoDo: soDo.MaSoDo },
      });
      const loaiGhe = await prisma.loaiGhe.create({
        data: { TenLoaiGhe: 'Seat Standard', PhuThu: 0 },
      });

      // Create 4 seats (since it is 2x2)
      const seatA1 = await prisma.ghe.create({
        data: { ViTriDay: 'A', ViTriCot: 1, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
      });
      const seatA2 = await prisma.ghe.create({
        data: { ViTriDay: 'A', ViTriCot: 2, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
      });
      const seatB1 = await prisma.ghe.create({
        data: { ViTriDay: 'B', ViTriCot: 1, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
      });
      const seatB2 = await prisma.ghe.create({
        data: { ViTriDay: 'B', ViTriCot: 2, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
      });

      const loaiNgay = await prisma.loaiNgay.create({
        data: { TenLoaiNgay: 'Weekday Stats 2', PhuThu: 0 },
      });

      const showtime = await prisma.suatChieu.create({
        data: {
          MaPhim: movie.MaPhim,
          MaPhong: phong.MaPhong,
          MaLoaiNgay: loaiNgay.MaLoaiNgay,
          NgayChieu: new Date('2026-06-20'),
          GioChieu: new Date('2026-06-20T14:00:00Z'),
          GiaVeGoc: 50000,
        },
      });

      // Generate showtime seats: A1, A2, B1 is empty, B2 is booked.
      await prisma.gheSuatChieu.create({
        data: { MaSuatChieu: showtime.MaSuatChieu, MaGhe: seatA1.MaGhe, TrangThai: TrangThaiGheSuatChieu.TRONG, GiaVe: 50000 },
      });
      await prisma.gheSuatChieu.create({
        data: { MaSuatChieu: showtime.MaSuatChieu, MaGhe: seatA2.MaGhe, TrangThai: TrangThaiGheSuatChieu.TRONG, GiaVe: 50000 },
      });
      await prisma.gheSuatChieu.create({
        data: { MaSuatChieu: showtime.MaSuatChieu, MaGhe: seatB1.MaGhe, TrangThai: TrangThaiGheSuatChieu.TRONG, GiaVe: 50000 },
      });
      await prisma.gheSuatChieu.create({
        data: { MaSuatChieu: showtime.MaSuatChieu, MaGhe: seatB2.MaGhe, TrangThai: TrangThaiGheSuatChieu.DA_DAT, GiaVe: 50000 },
      });

      // Check fill rate stats
      const res = await request(app)
        .get('/api/v1/admin/thong-ke/ti-le-ghe')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);

      const scStat = res.body.data[0];
      expect(scStat.MaSuatChieu).toBe(showtime.MaSuatChieu);
      expect(scStat.TenPhim).toBe('Movie Fill Rate');
      expect(scStat.TenPhong).toBe('Room 102');
      expect(scStat.TongSoGhe).toBe(4);
      expect(scStat.SoGheDaDat).toBe(1);
      expect(scStat.TiLeLapDay).toBe(25); // 1 / 4 * 100
    });
  });
});
