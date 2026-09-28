import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import {
  Role,
  TrangThaiPhieuDatVe,
  TrangThaiGheSuatChieu,
  TrangThaiGiaoDich,
  PhuongThucThanhToan,
} from '@prisma/client';
import {
  cleanupTestData,
  createTestAdmin,
  createTestCustomer,
  loginAndGetToken,
} from '../helpers';

describe('💳 Quản Lý Giao Dịch & Hoàn Tiền Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let testCustomerUser: any;

  beforeAll(async () => {
    await cleanupTestData();

    await createTestAdmin('admin_gd_test', 'password123');
    const createdCust = await createTestCustomer('cust_gd_test', 'password123');
    testCustomerUser = await prisma.taiKhoan.findUnique({
      where: { MaTaiKhoan: createdCust.MaTaiKhoan },
      include: { KhachHang: true },
    });

    adminToken = await loginAndGetToken(app, 'admin_gd_test', 'password123');
    customerToken = await loginAndGetToken(app, 'cust_gd_test', 'password123');
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.lichSuHoanTien.deleteMany({});
    await prisma.giaoDich.deleteMany({});
    await prisma.chiTietDatVe.deleteMany({});
    await prisma.phieuDatVe.deleteMany({});
    await prisma.gheSuatChieu.deleteMany({});
    await prisma.suatChieu.deleteMany({});
    await prisma.phim.deleteMany({});
    await prisma.ghe.deleteMany({});
    await prisma.phongChieu.deleteMany({});
    await prisma.soDoGhe.deleteMany({});
    await prisma.loaiGhe.deleteMany({});
    await prisma.loaiPhong.deleteMany({});
    await prisma.loaiNgay.deleteMany({});
  });

  const setupTestData = async (bookingStatus: TrangThaiPhieuDatVe, transactionStatus: TrangThaiGiaoDich) => {
    const movie = await prisma.phim.create({
      data: {
        TenPhim: 'Movie GD',
        DaoDien: 'Dir',
        DienVien: 'Cast',
        TheLoai: 'Action',
        ThoiLuong: 120,
        NgayKhoiChieu: new Date(),
        GioiHanTuoi: 'C13',
        NoiDung: 'Summary',
        Trailer: 'http://youtube.com',
        HinhAnh: 'http://poster.com',
      },
    });

    const loaiPhong = await prisma.loaiPhong.create({
      data: { TenLoaiPhong: 'Standard 2D', PhuThu: 0 },
    });

    const template = await prisma.soDoGhe.create({
      data: { TenSoDo: 'Standard 8x8', SoHang: 8, SoCot: 8 },
    });

    const room = await prisma.phongChieu.create({
      data: {
        TenPhong: 'Room GD',
        MaLoaiPhong: loaiPhong.MaLoaiPhong,
        MaSoDo: template.MaSoDo,
      },
    });

    const dayType = await prisma.loaiNgay.create({
      data: { TenLoaiNgay: 'Weekday', PhuThu: 0 },
    });

    const showtime = await prisma.suatChieu.create({
      data: {
        MaPhim: movie.MaPhim,
        MaPhong: room.MaPhong,
        MaLoaiNgay: dayType.MaLoaiNgay,
        NgayChieu: new Date(),
        GioChieu: new Date(),
        GiaVeGoc: 50000,
      },
    });

    const loaiGhe = await prisma.loaiGhe.create({
      data: { TenLoaiGhe: 'Standard Seat', PhuThu: 0 },
    });

    const seat = await prisma.ghe.create({
      data: {
        ViTriDay: 'A',
        ViTriCot: 1,
        MaPhong: room.MaPhong,
        MaLoaiGhe: loaiGhe.MaLoaiGhe,
      },
    });

    const seatShowtime = await prisma.gheSuatChieu.create({
      data: {
        MaSuatChieu: showtime.MaSuatChieu,
        MaGhe: seat.MaGhe,
        TrangThai: TrangThaiGheSuatChieu.DA_DAT,
        GiaVe: 50000,
      },
    });

    const booking = await prisma.phieuDatVe.create({
      data: {
        MaKhachHang: testCustomerUser.KhachHang.MaKhachHang,
        TongTien: 50000,
        TrangThai: bookingStatus,
      },
    });

    await prisma.chiTietDatVe.create({
      data: {
        MaPhieuDat: booking.MaPhieuDat,
        MaGheSuatChieu: seatShowtime.MaGheSuatChieu,
        GiaVe: 50000,
      },
    });

    const transaction = await prisma.giaoDich.create({
      data: {
        MaPhieuDat: booking.MaPhieuDat,
        PhuongThuc: PhuongThucThanhToan.VNPAY,
        SoTien: 50000,
        TrangThai: transactionStatus,
      },
    });

    return { booking, transaction, seatShowtime };
  };

  describe('🔑 Authorization', () => {
    it('should block non-admin from listing bookings', async () => {
      const res = await request(app)
        .get('/api/v1/admin/giao-dich/phieu-dat')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('📦 Booking List & Details', () => {
    it('should list bookings with filters successfully', async () => {
      const { booking } = await setupTestData(
        TrangThaiPhieuDatVe.DA_THANH_TOAN,
        TrangThaiGiaoDich.THANH_CONG,
      );

      const res = await request(app)
        .get('/api/v1/admin/giao-dich/phieu-dat')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 10,
          trangThai: TrangThaiPhieuDatVe.DA_THANH_TOAN,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].MaPhieuDat).toBe(booking.MaPhieuDat);

      // Search matching customer username
      const searchRes = await request(app)
        .get('/api/v1/admin/giao-dich/phieu-dat')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: 'cust_gd' });

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should get booking details successfully', async () => {
      const { booking } = await setupTestData(
        TrangThaiPhieuDatVe.DA_THANH_TOAN,
        TrangThaiGiaoDich.THANH_CONG,
      );

      const res = await request(app)
        .get(`/api/v1/admin/giao-dich/phieu-dat/${booking.MaPhieuDat}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.MaPhieuDat).toBe(booking.MaPhieuDat);
      expect(res.body.data.ChiTietDatVes).toHaveLength(1);
    });
  });

  describe('❌ Booking Cancellation', () => {
    it('should cancel booking and release seat successfully', async () => {
      const { booking, seatShowtime } = await setupTestData(
        TrangThaiPhieuDatVe.CHO_THANH_TOAN,
        TrangThaiGiaoDich.CHO_XU_LY,
      );

      const res = await request(app)
        .patch(`/api/v1/admin/giao-dich/phieu-dat/${booking.MaPhieuDat}/huy`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.TrangThai).toBe(TrangThaiPhieuDatVe.DA_HUY);

      // Verify seat is released
      const dbSeat = await prisma.gheSuatChieu.findUnique({
        where: { MaGheSuatChieu: seatShowtime.MaGheSuatChieu },
      });
      expect(dbSeat?.TrangThai).toBe(TrangThaiGheSuatChieu.TRONG);

      // Verify transaction marked as failed
      const dbTransaction = await prisma.giaoDich.findFirst({
        where: { MaPhieuDat: booking.MaPhieuDat },
      });
      expect(dbTransaction?.TrangThai).toBe(TrangThaiGiaoDich.THAT_BAI);
    });
  });

  describe('💸 Transaction Refund', () => {
    it('should refund transaction, cancel booking, release seat, and write history', async () => {
      const { transaction, booking, seatShowtime } = await setupTestData(
        TrangThaiPhieuDatVe.DA_THANH_TOAN,
        TrangThaiGiaoDich.THANH_CONG,
      );

      const res = await request(app)
        .post(`/api/v1/admin/giao-dich/${transaction.MaGiaoDich}/hoan-tien`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          SoTienHoan: 40000, // Partial refund
          LyDo: 'Khách hàng đổi ý',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.TrangThai).toBe(TrangThaiGiaoDich.DA_HOAN_TIEN);

      // Verify refund history
      const refunds = await prisma.lichSuHoanTien.findMany({
        where: { MaGiaoDich: transaction.MaGiaoDich },
      });
      expect(refunds).toHaveLength(1);
      expect(Number(refunds[0].SoTienHoan)).toBe(40000);
      expect(refunds[0].LyDo).toBe('Khách hàng đổi ý');

      // Verify booking cancelled
      const dbBooking = await prisma.phieuDatVe.findUnique({
        where: { MaPhieuDat: booking.MaPhieuDat },
      });
      expect(dbBooking?.TrangThai).toBe(TrangThaiPhieuDatVe.DA_HUY);

      // Verify seat released
      const dbSeat = await prisma.gheSuatChieu.findUnique({
        where: { MaGheSuatChieu: seatShowtime.MaGheSuatChieu },
      });
      expect(dbSeat?.TrangThai).toBe(TrangThaiGheSuatChieu.TRONG);
    });

    it('should fail refund if amount exceeds transaction amount', async () => {
      const { transaction } = await setupTestData(
        TrangThaiPhieuDatVe.DA_THANH_TOAN,
        TrangThaiGiaoDich.THANH_CONG,
      );

      const res = await request(app)
        .post(`/api/v1/admin/giao-dich/${transaction.MaGiaoDich}/hoan-tien`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          SoTienHoan: 60000, // Exceeds 50000
          LyDo: 'Quá nhiều tiền',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('vượt quá số tiền giao dịch');
    });

    it('should fail refund if transaction status is not THANH_CONG', async () => {
      const { transaction } = await setupTestData(
        TrangThaiPhieuDatVe.CHO_THANH_TOAN,
        TrangThaiGiaoDich.CHO_XU_LY,
      );

      const res = await request(app)
        .post(`/api/v1/admin/giao-dich/${transaction.MaGiaoDich}/hoan-tien`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          SoTienHoan: 10000,
          LyDo: 'Chưa thanh toán',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('không ở trạng thái thành công');
    });
  });
});
