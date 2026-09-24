import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { Role, TrangThaiPhieuDatVe, TrangThaiGiaoDich, TrangThaiGheSuatChieu } from '@prisma/client';
import {
  cleanupTestData,
  createTestAdmin,
  createTestCustomer,
  createTestStaff,
  loginAndGetToken,
  createTestMovie,
} from '../helpers';

describe('🖥️ Staff Ticket Validation and Check-in Integration Tests', () => {
  let staffToken: string;
  let adminToken: string;
  let customerToken: string;
  let staffAccount: any;
  let adminAccount: any;
  let customerAccount: any;
  let showtime: any;
  let movie: any;
  let seat1: any;
  let seat2: any;
  let seat3: any;
  let booking: any;
  let ticket1: any;
  let ticket2: any;
  let ticket3: any;

  beforeAll(async () => {
    await cleanupTestData();

    // Create accounts
    staffAccount = await createTestStaff('staff_checkin_1', 'password123');
    const nv = await prisma.nhanVien.findFirst({
      where: { MaTaiKhoan: staffAccount.MaTaiKhoan },
    });
    staffAccount.NhanVien = nv;

    adminAccount = await createTestAdmin('admin_checkin_1', 'password123');
    customerAccount = await createTestCustomer('customer_checkin_1', 'password123');
    const kh = await prisma.khachHang.findFirst({
      where: { MaTaiKhoan: customerAccount.MaTaiKhoan },
    });
    customerAccount.KhachHang = kh;

    // Retrieve tokens
    staffToken = await loginAndGetToken(app, 'staff_checkin_1', 'password123');
    adminToken = await loginAndGetToken(app, 'admin_checkin_1', 'password123');
    customerToken = await loginAndGetToken(app, 'customer_checkin_1', 'password123');
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.cauHinhVanHanh.upsert({
      where: { Id: 1 },
      update: { ThoiGianGiuGhePhut: 10, CuaSoCheckInPhut: 30, HanHuyCaTruocGio: 2 },
      create: { Id: 1, ThoiGianGiuGhePhut: 10, CuaSoCheckInPhut: 30, HanHuyCaTruocGio: 2 },
    });
    // Clean up dynamic data
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
    await prisma.ghe.deleteMany({});
    await prisma.phongChieu.deleteMany({});
    await prisma.loaiGhe.deleteMany({});
    await prisma.loaiPhong.deleteMany({});
    await prisma.soDoGhe.deleteMany({});
    await prisma.loaiNgay.deleteMany({});

    // Seed configuration
    movie = await createTestMovie({ TenPhim: 'Checkin Test Phim', ThoiLuong: 120 });
    const soDo = await prisma.soDoGhe.create({
      data: { TenSoDo: 'Sơ Đồ Checkin', SoHang: 5, SoCot: 5 },
    });
    const loaiPhong = await prisma.loaiPhong.create({
      data: { TenLoaiPhong: 'IMAX', PhuThu: 20000.0 },
    });
    const phong = await prisma.phongChieu.create({
      data: { TenPhong: 'IMAX Room', MaLoaiPhong: loaiPhong.MaLoaiPhong, MaSoDo: soDo.MaSoDo },
    });
    const loaiNgay = await prisma.loaiNgay.create({
      data: { TenLoaiNgay: 'Weekday', PhuThu: 5000.0 },
    });
    const loaiGhe = await prisma.loaiGhe.create({
      data: { TenLoaiGhe: 'Standard Seat', PhuThu: 0.0 },
    });

    const g1 = await prisma.ghe.create({
      data: { ViTriDay: 'C', ViTriCot: 1, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
    });
    const g2 = await prisma.ghe.create({
      data: { ViTriDay: 'C', ViTriCot: 2, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
    });
    const g3 = await prisma.ghe.create({
      data: { ViTriDay: 'C', ViTriCot: 3, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
    });

    // Create a future showtime: 2 hours from now
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2);

    showtime = await prisma.suatChieu.create({
      data: {
        MaPhim: movie.MaPhim,
        MaPhong: phong.MaPhong,
        MaLoaiNgay: loaiNgay.MaLoaiNgay,
        NgayChieu: futureDate,
        GioChieu: futureDate,
        GiaVeGoc: 50000.0,
      },
    });

    seat1 = await prisma.gheSuatChieu.create({
      data: {
        MaSuatChieu: showtime.MaSuatChieu,
        MaGhe: g1.MaGhe,
        TrangThai: 'DA_DAT',
        GiaVe: 50000.0,
      },
    });
    seat2 = await prisma.gheSuatChieu.create({
      data: {
        MaSuatChieu: showtime.MaSuatChieu,
        MaGhe: g2.MaGhe,
        TrangThai: 'DA_DAT',
        GiaVe: 50000.0,
      },
    });
    seat3 = await prisma.gheSuatChieu.create({
      data: {
        MaSuatChieu: showtime.MaSuatChieu,
        MaGhe: g3.MaGhe,
        TrangThai: 'DA_DAT',
        GiaVe: 50000.0,
      },
    });

    // Create a standard paid booking
    booking = await prisma.phieuDatVe.create({
      data: {
        MaKhachHang: customerAccount.KhachHang.MaKhachHang,
        TongTien: 150000.0,
        TrangThai: TrangThaiPhieuDatVe.DA_THANH_TOAN,
        KhaDung: true,
      },
    });

    ticket1 = await prisma.chiTietDatVe.create({
      data: {
        MaPhieuDat: booking.MaPhieuDat,
        MaGheSuatChieu: seat1.MaGheSuatChieu,
        GiaVe: 50000.0,
      },
    });
    ticket2 = await prisma.chiTietDatVe.create({
      data: {
        MaPhieuDat: booking.MaPhieuDat,
        MaGheSuatChieu: seat2.MaGheSuatChieu,
        GiaVe: 50000.0,
      },
    });
    ticket3 = await prisma.chiTietDatVe.create({
      data: {
        MaPhieuDat: booking.MaPhieuDat,
        MaGheSuatChieu: seat3.MaGheSuatChieu,
        GiaVe: 50000.0,
      },
    });

    // Create a successful transaction
    await prisma.giaoDich.create({
      data: {
        MaPhieuDat: booking.MaPhieuDat,
        PhuongThuc: 'TIEN_MAT',
        SoTien: 150000.0,
        TrangThai: TrangThaiGiaoDich.THANH_CONG,
        MaGiaoDichNgoai: 'TX_123',
      },
    });
  });

  describe('🔍 Flow 1: POST /api/v1/staff/soat-ve/kiem-tra', () => {
    it('should validate a valid ticket successfully', async () => {
      // Modify showtime to make sure now is inside check-in window (from 30m before showtime starts)
      // Currently showtime is 2h from now, so let's set showtime to 15m from now
      const checkInWindowTime = new Date(Date.now() + 15 * 60 * 1000);
      await prisma.suatChieu.update({
        where: { MaSuatChieu: showtime.MaSuatChieu },
        data: {
          NgayChieu: checkInWindowTime,
          GioChieu: checkInWindowTime,
        },
      });

      const res = await request(app)
        .post('/api/v1/staff/soat-ve/kiem-tra')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaChiTietDat: ticket1.MaChiTietDat,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.reason).toBe('Vé hợp lệ');
      expect(res.body.data.ticketInfo.MaChiTietDat).toBe(ticket1.MaChiTietDat);
      expect(res.body.data.ticketInfo.TenPhim).toBe('Checkin Test Phim');
      expect(res.body.data.ticketInfo.Ghe).toBe('C1');
    });

    it('should apply the configured check-in window and message', async () => {
      await prisma.cauHinhVanHanh.update({
        where: { Id: 1 },
        data: { CuaSoCheckInPhut: 10 },
      });
      const showtimeInFifteenMinutes = new Date(Date.now() + 15 * 60 * 1000);
      await prisma.suatChieu.update({
        where: { MaSuatChieu: showtime.MaSuatChieu },
        data: { NgayChieu: showtimeInFifteenMinutes, GioChieu: showtimeInFifteenMinutes },
      });

      const res = await request(app)
        .post('/api/v1/staff/soat-ve/kiem-tra')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ MaChiTietDat: ticket1.MaChiTietDat });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.reason).toContain('10 phút');
    });

    it('should reject a non-existent ticket', async () => {
      const res = await request(app)
        .post('/api/v1/staff/soat-ve/kiem-tra')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaChiTietDat: '00000000-0000-0000-0000-000000000000',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.reason).toBe('Vé không tồn tại');
    });

    it('should reject a ticket from a cancelled booking', async () => {
      await prisma.phieuDatVe.update({
        where: { MaPhieuDat: booking.MaPhieuDat },
        data: { TrangThai: TrangThaiPhieuDatVe.DA_HUY },
      });

      const res = await request(app)
        .post('/api/v1/staff/soat-ve/kiem-tra')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaChiTietDat: ticket1.MaChiTietDat,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.reason).toBe('Vé đã bị hủy');
    });

    it('should reject a ticket with pending or approved refund', async () => {
      const tx = await prisma.giaoDich.findFirst({
        where: { MaPhieuDat: booking.MaPhieuDat },
      });

      await prisma.lichSuHoanTien.create({
        data: {
          MaGiaoDich: tx!.MaGiaoDich,
          SoTienHoan: 150000.0,
          LyDo: 'Hủy vé',
          TrangThai: 'CHO_XU_LY',
        },
      });

      const res = await request(app)
        .post('/api/v1/staff/soat-ve/kiem-tra')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaChiTietDat: ticket1.MaChiTietDat,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.reason).toBe('Vé đang hoàn tiền / đã hoàn tiền');
    });

    it('should allow check-in if refund was rejected (TU_CHOI)', async () => {
      const checkInWindowTime = new Date(Date.now() + 15 * 60 * 1000);
      await prisma.suatChieu.update({
        where: { MaSuatChieu: showtime.MaSuatChieu },
        data: { NgayChieu: checkInWindowTime, GioChieu: checkInWindowTime },
      });

      const tx = await prisma.giaoDich.findFirst({
        where: { MaPhieuDat: booking.MaPhieuDat },
      });

      await prisma.lichSuHoanTien.create({
        data: {
          MaGiaoDich: tx!.MaGiaoDich,
          SoTienHoan: 150000.0,
          LyDo: 'Hủy vé',
          TrangThai: 'TU_CHOI',
        },
      });

      const res = await request(app)
        .post('/api/v1/staff/soat-ve/kiem-tra')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaChiTietDat: ticket1.MaChiTietDat,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
    });

    it('should reject already checked-in ticket', async () => {
      await prisma.chiTietDatVe.update({
        where: { MaChiTietDat: ticket1.MaChiTietDat },
        data: {
          DaCheckIn: true,
          ThoiGianCheckIn: new Date(),
          MaNhanVienCheckIn: staffAccount.NhanVien.MaNhanVien,
        },
      });

      const res = await request(app)
        .post('/api/v1/staff/soat-ve/kiem-tra')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaChiTietDat: ticket1.MaChiTietDat,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.reason).toBe('Vé đã được sử dụng');
    });

    it('should reject unpaid booking', async () => {
      await prisma.phieuDatVe.update({
        where: { MaPhieuDat: booking.MaPhieuDat },
        data: { TrangThai: TrangThaiPhieuDatVe.CHO_THANH_TOAN },
      });

      const res = await request(app)
        .post('/api/v1/staff/soat-ve/kiem-tra')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaChiTietDat: ticket1.MaChiTietDat,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.reason).toBe('Thanh toán chưa hoàn tất');
    });

    it('should reject if showtime check-in window is not yet open', async () => {
      // Showtime is 2 hours from now, check-in starts 30 minutes before, so it should be blocked
      const res = await request(app)
        .post('/api/v1/staff/soat-ve/kiem-tra')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaChiTietDat: ticket1.MaChiTietDat,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.reason).toBe('Chưa đến giờ check-in (trước 30 phút suất chiếu)');
    });
  });

  describe('🔒 Flow 2: POST /api/v1/staff/soat-ve/check-in', () => {
    it('should check in a valid ticket successfully', async () => {
      const checkInWindowTime = new Date(Date.now() + 15 * 60 * 1000);
      await prisma.suatChieu.update({
        where: { MaSuatChieu: showtime.MaSuatChieu },
        data: { NgayChieu: checkInWindowTime, GioChieu: checkInWindowTime },
      });

      const res = await request(app)
        .post('/api/v1/staff/soat-ve/check-in')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaChiTietDat: ticket2.MaChiTietDat,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.MaChiTietDat).toBe(ticket2.MaChiTietDat);
      expect(res.body.data.NhanVienCheckIn.MaNhanVien).toBe(staffAccount.NhanVien.MaNhanVien);

      // Verify DB update
      const dbTicket = await prisma.chiTietDatVe.findUnique({
        where: { MaChiTietDat: ticket2.MaChiTietDat },
      });
      expect(dbTicket?.DaCheckIn).toBe(true);
      expect(dbTicket?.MaNhanVienCheckIn).toBe(staffAccount.NhanVien.MaNhanVien);
      expect(dbTicket?.ThoiGianCheckIn).toBeDefined();
    });

    it('should block double check-in and throw BadRequestError', async () => {
      const checkInWindowTime = new Date(Date.now() + 15 * 60 * 1000);
      await prisma.suatChieu.update({
        where: { MaSuatChieu: showtime.MaSuatChieu },
        data: { NgayChieu: checkInWindowTime, GioChieu: checkInWindowTime },
      });

      // Check-in first time
      await request(app)
        .post('/api/v1/staff/soat-ve/check-in')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaChiTietDat: ticket3.MaChiTietDat,
        });

      // Second check-in should fail with 400
      const res = await request(app)
        .post('/api/v1/staff/soat-ve/check-in')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaChiTietDat: ticket3.MaChiTietDat,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Vé đã được sử dụng');
    });
  });

  describe('🔍 Flow 3: GET /api/v1/staff/soat-ve/lich-su', () => {
    it('should return paginated check-in history without exposing customer personal information', async () => {
      // Perform a check-in
      const checkInWindowTime = new Date(Date.now() + 15 * 60 * 1000);
      await prisma.suatChieu.update({
        where: { MaSuatChieu: showtime.MaSuatChieu },
        data: { NgayChieu: checkInWindowTime, GioChieu: checkInWindowTime },
      });

      await request(app)
        .post('/api/v1/staff/soat-ve/check-in')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaChiTietDat: ticket1.MaChiTietDat,
        });

      const res = await request(app)
        .get('/api/v1/staff/soat-ve/lich-su')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);

      const historyLog = res.body.data[0];
      expect(historyLog.MaChiTietDat).toBe(ticket1.MaChiTietDat);
      expect(historyLog.NhanVienCheckIn.MaNhanVien).toBe(staffAccount.NhanVien.MaNhanVien);

      // Verify that customer sensitive details are NOT exposed
      expect(historyLog.Email).toBeUndefined();
      expect(historyLog.SoDienThoai).toBeUndefined();
    });
  });

  describe('🛡️ Role blocking checks', () => {
    const endpoints = [
      { method: 'post', url: '/api/v1/staff/soat-ve/kiem-tra', body: { MaChiTietDat: '00000000-0000-0000-0000-000000000000' } },
      { method: 'post', url: '/api/v1/staff/soat-ve/check-in', body: { MaChiTietDat: '00000000-0000-0000-0000-000000000000' } },
      { method: 'get', url: '/api/v1/staff/soat-ve/lich-su' },
    ];

    endpoints.forEach(({ method, url, body }) => {
      it(`should block Guest access to ${method.toUpperCase()} ${url}`, async () => {
        const reqBuilder = request(app)[method as 'get' | 'post'](url);
        if (body) reqBuilder.send(body);

        const res = await reqBuilder;
        expect(res.status).toBe(401);
      });

      it(`should block CUSTOMER access to ${method.toUpperCase()} ${url}`, async () => {
        const reqBuilder = request(app)[method as 'get' | 'post'](url).set('Authorization', `Bearer ${customerToken}`);
        if (body) reqBuilder.send(body);

        const res = await reqBuilder;
        expect(res.status).toBe(403);
      });

      it(`should block ADMIN access to ${method.toUpperCase()} ${url}`, async () => {
        const reqBuilder = request(app)[method as 'get' | 'post'](url).set('Authorization', `Bearer ${adminToken}`);
        if (body) reqBuilder.send(body);

        const res = await reqBuilder;
        expect(res.status).toBe(403);
      });
    });
  });
});
