import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { TrangThaiGheSuatChieu, TrangThaiPhieuDatVe } from '@prisma/client';
import {
  cleanupTestData,
  createTestAdmin,
  createTestCustomer,
  loginAndGetToken,
  createTestMovie,
} from '../helpers';

describe('📅 Suất Chiếu & Ghế Suất Chiếu Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  
  let defaultMovieId: string;
  let defaultRoomId: string;
  let defaultLoaiNgayId: string;
  
  let defaultLoaiPhongId: string;
  let defaultLoaiGheId: string;

  beforeAll(async () => {
    await cleanupTestData();

    // Create test accounts
    await createTestAdmin('admin_suatchieu', 'password123');
    await createTestCustomer('customer_suatchieu', 'password123');

    // Login and get tokens
    adminToken = await loginAndGetToken(app, 'admin_suatchieu', 'password123');
    customerToken = await loginAndGetToken(app, 'customer_suatchieu', 'password123');
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean tables sequentially in reverse dependency order
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

    // Seed base entities
    const movie = await createTestMovie();
    defaultMovieId = movie.MaPhim;

    const soDo = await prisma.soDoGhe.create({
      data: { TenSoDo: 'Standard 4x4', SoHang: 4, SoCot: 4 },
    });

    const loaiPhong = await prisma.loaiPhong.create({
      data: { TenLoaiPhong: 'Standard 2D', PhuThu: 5000.0 },
    });
    defaultLoaiPhongId = loaiPhong.MaLoaiPhong;

    const room = await prisma.phongChieu.create({
      data: { TenPhong: 'Room A', MaLoaiPhong: defaultLoaiPhongId, MaSoDo: soDo.MaSoDo },
    });
    defaultRoomId = room.MaPhong;

    const loaiGhe = await prisma.loaiGhe.create({
      data: { TenLoaiGhe: 'Thường', PhuThu: 1000.0 },
    });
    defaultLoaiGheId = loaiGhe.MaLoaiGhe;

    // Generate 16 seats for the 4x4 room (15 active, 1 inactive)
    const seatsData = [];
    for (let h = 0; h < 4; h++) {
      const rowChar = String.fromCharCode(65 + h); // A, B, C, D
      for (let c = 1; c <= 4; c++) {
        seatsData.push({
          ViTriDay: rowChar,
          ViTriCot: c,
          MaPhong: defaultRoomId,
          MaLoaiGhe: defaultLoaiGheId,
          KhaDung: !(rowChar === 'D' && c === 4), // D4 is broken (inactive)
        });
      }
    }
    await prisma.ghe.createMany({ data: seatsData });

    const loaiNgay = await prisma.loaiNgay.create({
      data: { TenLoaiNgay: 'Cuối tuần', PhuThu: 15000.0 },
    });
    defaultLoaiNgayId = loaiNgay.MaLoaiNgay;
  });

  describe('🔑 Authorization', () => {
    it('should block non-admin from creating a showtime', async () => {
      const res = await request(app)
        .post('/api/v1/admin/suat-chieu')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaPhim: defaultMovieId,
          MaPhong: defaultRoomId,
          MaLoaiNgay: defaultLoaiNgayId,
          NgayChieu: '2026-12-01',
          GioChieu: '2026-12-01T10:00:00Z',
          GiaVeGoc: 60000,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('📦 CRUD Showtime', () => {
    it('should create showtime and auto-generate 15 showtime seats with correct prices', async () => {
      const res = await request(app)
        .post('/api/v1/admin/suat-chieu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          MaPhim: defaultMovieId,
          MaPhong: defaultRoomId,
          MaLoaiNgay: defaultLoaiNgayId,
          NgayChieu: '2026-12-01T00:00:00.000Z',
          GioChieu: '2026-12-01T10:00:00.000Z',
          GiaVeGoc: 60000.0,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.MaPhong).toBe(defaultRoomId);

      const maSuatChieu = res.body.data.MaSuatChieu;

      // Verify showtime seats are generated (15 active seats only)
      const gheSuatChieus = await prisma.gheSuatChieu.findMany({
        where: { MaSuatChieu: maSuatChieu },
      });
      expect(gheSuatChieus).toHaveLength(15);

      // Verify price calculation: Base 60000 + Room 5000 + Seat 1000 + Day 15000 = 81000
      expect(Number(gheSuatChieus[0].GiaVe)).toBe(81000);
      expect(gheSuatChieus[0].TrangThai).toBe(TrangThaiGheSuatChieu.TRONG);
    });

    it('should prevent creating a showtime in the past', async () => {
      const res = await request(app)
        .post('/api/v1/admin/suat-chieu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          MaPhim: defaultMovieId,
          MaPhong: defaultRoomId,
          MaLoaiNgay: defaultLoaiNgayId,
          NgayChieu: '2020-01-01T00:00:00.000Z',
          GioChieu: '2020-01-01T10:00:00.000Z',
          GiaVeGoc: 60000.0,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('quá khứ');
    });

    it('should prevent scheduling overlapping showtimes in the same room', async () => {
      // Create first showtime at 10:00 (duration is 120 mins, ends at 12:00)
      await request(app)
        .post('/api/v1/admin/suat-chieu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          MaPhim: defaultMovieId,
          MaPhong: defaultRoomId,
          MaLoaiNgay: defaultLoaiNgayId,
          NgayChieu: '2026-12-05T00:00:00.000Z',
          GioChieu: '2026-12-05T10:00:00.000Z',
          GiaVeGoc: 60000.0,
        });

      // Attempt to schedule second showtime starting at 11:30 in same room
      const res = await request(app)
        .post('/api/v1/admin/suat-chieu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          MaPhim: defaultMovieId,
          MaPhong: defaultRoomId,
          MaLoaiNgay: defaultLoaiNgayId,
          NgayChieu: '2026-12-05T00:00:00.000Z',
          GioChieu: '2026-12-05T11:30:00.000Z',
          GiaVeGoc: 60000.0,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('trùng lịch');
    });

    it('should read showtimes using public API filters and read details with seats layout', async () => {
      // Create a showtime
      const sc = await prisma.suatChieu.create({
        data: {
          MaPhim: defaultMovieId,
          MaPhong: defaultRoomId,
          MaLoaiNgay: defaultLoaiNgayId,
          NgayChieu: new Date('2026-12-10T00:00:00Z'),
          GioChieu: new Date('1970-01-01T15:00:00Z'),
          GiaVeGoc: 50000.0,
        },
      });

      // Get list
      const resList = await request(app)
        .get('/api/v1/suat-chieu')
        .query({ maPhim: defaultMovieId, ngayChieu: '2026-12-10' });

      expect(resList.status).toBe(200);
      expect(resList.body.data).toHaveLength(1);
      expect(resList.body.data[0].MaSuatChieu).toBe(sc.MaSuatChieu);

      // Get seats layout
      const resSeats = await request(app).get(`/api/v1/suat-chieu/${sc.MaSuatChieu}/ghe`);
      expect(resSeats.status).toBe(200);
    });

    it('should update showtime fields and recalculate seat prices when no tickets are sold', async () => {
      const sc = await prisma.suatChieu.create({
        data: {
          MaPhim: defaultMovieId,
          MaPhong: defaultRoomId,
          MaLoaiNgay: defaultLoaiNgayId,
          NgayChieu: new Date('2026-12-12T00:00:00Z'),
          GioChieu: new Date('1970-01-01T15:00:00Z'),
          GiaVeGoc: 50000.0,
        },
      });

      // Generate seat records for it
      const seat = await prisma.ghe.findFirst({ where: { MaPhong: defaultRoomId } });
      const gsc = await prisma.gheSuatChieu.create({
        data: {
          MaSuatChieu: sc.MaSuatChieu,
          MaGhe: seat!.MaGhe,
          TrangThai: TrangThaiGheSuatChieu.TRONG,
          GiaVe: 71000.0,
        },
      });

      // Update base price to 80000.0
      const resUpdate = await request(app)
        .put(`/api/v1/admin/suat-chieu/${sc.MaSuatChieu}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ GiaVeGoc: 80000.0 });

      expect(resUpdate.status).toBe(200);

      // Verify price updated: Base 80000 + Room 5000 + Seat 1000 + Day 15000 = 101000
      const dbGsc = await prisma.gheSuatChieu.findUnique({
        where: { MaGheSuatChieu: gsc.MaGheSuatChieu },
      });
      expect(Number(dbGsc?.GiaVe)).toBe(101000);
    });

    it('should block updating room or prices if tickets are sold', async () => {
      const sc = await prisma.suatChieu.create({
        data: {
          MaPhim: defaultMovieId,
          MaPhong: defaultRoomId,
          MaLoaiNgay: defaultLoaiNgayId,
          NgayChieu: new Date('2026-12-14T00:00:00Z'),
          GioChieu: new Date('1970-01-01T15:00:00Z'),
          GiaVeGoc: 50000.0,
        },
      });

      const seat = await prisma.ghe.findFirst({ where: { MaPhong: defaultRoomId } });
      const gsc = await prisma.gheSuatChieu.create({
        data: {
          MaSuatChieu: sc.MaSuatChieu,
          MaGhe: seat!.MaGhe,
          TrangThai: TrangThaiGheSuatChieu.DA_DAT,
          GiaVe: 71000.0,
        },
      });

      // Add related booking ticket detail
      const customer = await prisma.taiKhoan.findFirst({
        where: { TenDangNhap: 'customer_suatchieu' },
        include: { KhachHang: true },
      });

      const phieu = await prisma.phieuDatVe.create({
        data: {
          MaKhachHang: customer!.KhachHang!.MaKhachHang,
          TongTien: 71000.0,
          TrangThai: TrangThaiPhieuDatVe.DA_THANH_TOAN,
        },
      });

      await prisma.chiTietDatVe.create({
        data: {
          MaPhieuDat: phieu.MaPhieuDat,
          MaGheSuatChieu: gsc.MaGheSuatChieu,
          GiaVe: 71000.0,
        },
      });

      // Attempt to modify GiaVeGoc
      const res = await request(app)
        .put(`/api/v1/admin/suat-chieu/${sc.MaSuatChieu}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ GiaVeGoc: 80000.0 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Không thể sửa đổi');
    });

    it('should successfully cascade delete showtime when no tickets are sold', async () => {
      const sc = await prisma.suatChieu.create({
        data: {
          MaPhim: defaultMovieId,
          MaPhong: defaultRoomId,
          MaLoaiNgay: defaultLoaiNgayId,
          NgayChieu: new Date('2026-12-16T00:00:00Z'),
          GioChieu: new Date('1970-01-01T15:00:00Z'),
          GiaVeGoc: 50000.0,
        },
      });

      const seat = await prisma.ghe.findFirst({ where: { MaPhong: defaultRoomId } });
      await prisma.gheSuatChieu.create({
        data: {
          MaSuatChieu: sc.MaSuatChieu,
          MaGhe: seat!.MaGhe,
          TrangThai: TrangThaiGheSuatChieu.TRONG,
          GiaVe: 71000.0,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/admin/suat-chieu/${sc.MaSuatChieu}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify deleted from db
      const dbSc = await prisma.suatChieu.findUnique({
        where: { MaSuatChieu: sc.MaSuatChieu },
      });
      const dbGscs = await prisma.gheSuatChieu.findMany({
        where: { MaSuatChieu: sc.MaSuatChieu },
      });

      expect(dbSc).toBeNull();
      expect(dbGscs).toHaveLength(0);
    });

    it('should block deleting showtime if tickets are sold', async () => {
      const sc = await prisma.suatChieu.create({
        data: {
          MaPhim: defaultMovieId,
          MaPhong: defaultRoomId,
          MaLoaiNgay: defaultLoaiNgayId,
          NgayChieu: new Date('2026-12-18T00:00:00Z'),
          GioChieu: new Date('1970-01-01T15:00:00Z'),
          GiaVeGoc: 50000.0,
        },
      });

      const seat = await prisma.ghe.findFirst({ where: { MaPhong: defaultRoomId } });
      const gsc = await prisma.gheSuatChieu.create({
        data: {
          MaSuatChieu: sc.MaSuatChieu,
          MaGhe: seat!.MaGhe,
          TrangThai: TrangThaiGheSuatChieu.DA_DAT,
          GiaVe: 71000.0,
        },
      });

      const customer = await prisma.taiKhoan.findFirst({
        where: { TenDangNhap: 'customer_suatchieu' },
        include: { KhachHang: true },
      });

      const phieu = await prisma.phieuDatVe.create({
        data: {
          MaKhachHang: customer!.KhachHang!.MaKhachHang,
          TongTien: 71000.0,
          TrangThai: TrangThaiPhieuDatVe.DA_THANH_TOAN,
        },
      });

      await prisma.chiTietDatVe.create({
        data: {
          MaPhieuDat: phieu.MaPhieuDat,
          MaGheSuatChieu: gsc.MaGheSuatChieu,
          GiaVe: 71000.0,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/admin/suat-chieu/${sc.MaSuatChieu}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Không thể xóa');
    });
  });
});
