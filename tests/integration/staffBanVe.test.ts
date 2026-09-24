import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { GioiHanTuoi, Role } from '@prisma/client';
import {
  cleanupTestData,
  createTestAdmin,
  createTestCustomer,
  createTestStaff,
  loginAndGetToken,
  createTestMovie,
} from '../helpers';

describe('🖥️ Staff POS Sell Ticket at Counter Integration Tests', () => {
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

  beforeAll(async () => {
    await cleanupTestData();

    // Create test accounts
    staffAccount = await createTestStaff('staff_pos_test_1', 'password123');
    const nv = await prisma.nhanVien.findFirst({
      where: { MaTaiKhoan: staffAccount.MaTaiKhoan },
    });
    staffAccount.NhanVien = nv;

    adminAccount = await createTestAdmin('admin_pos_test_1', 'password123');
    customerAccount = await createTestCustomer('customer_pos_test_1', 'password123');

    // Retrieve tokens
    staffToken = await loginAndGetToken(app, 'staff_pos_test_1', 'password123');
    adminToken = await loginAndGetToken(app, 'admin_pos_test_1', 'password123');
    customerToken = await loginAndGetToken(app, 'customer_pos_test_1', 'password123');
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
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

    // Seed configuration data
    movie = await createTestMovie({ TenPhim: 'POS Test Phim', ThoiLuong: 120 });
    const soDo = await prisma.soDoGhe.create({
      data: { TenSoDo: 'Sơ Đồ POS', SoHang: 5, SoCot: 5 },
    });
    const loaiPhong = await prisma.loaiPhong.create({
      data: { TenLoaiPhong: 'Standard', PhuThu: 10000.0 },
    });
    const phong = await prisma.phongChieu.create({
      data: { TenPhong: 'Room POS', MaLoaiPhong: loaiPhong.MaLoaiPhong, MaSoDo: soDo.MaSoDo },
    });
    const loaiNgay = await prisma.loaiNgay.create({
      data: { TenLoaiNgay: 'Weekday', PhuThu: 5000.0 },
    });
    const loaiGhe = await prisma.loaiGhe.create({
      data: { TenLoaiGhe: 'Standard Seat', PhuThu: 0.0 },
    });

    const g1 = await prisma.ghe.create({
      data: { ViTriDay: 'B', ViTriCot: 1, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
    });
    const g2 = await prisma.ghe.create({
      data: { ViTriDay: 'B', ViTriCot: 2, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
    });
    const g3 = await prisma.ghe.create({
      data: { ViTriDay: 'B', ViTriCot: 3, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
    });

    // Create a future showtime (e.g. 2 days from now)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    futureDate.setHours(19, 30, 0, 0);

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
        TrangThai: 'TRONG',
        GiaVe: 50000.0,
      },
    });
    seat2 = await prisma.gheSuatChieu.create({
      data: {
        MaSuatChieu: showtime.MaSuatChieu,
        MaGhe: g2.MaGhe,
        TrangThai: 'TRONG',
        GiaVe: 50000.0,
      },
    });
    seat3 = await prisma.gheSuatChieu.create({
      data: {
        MaSuatChieu: showtime.MaSuatChieu,
        MaGhe: g3.MaGhe,
        TrangThai: 'TRONG',
        GiaVe: 50000.0,
      },
    });
  });

  describe('🔍 Flow 1: GET /api/v1/staff/ban-ve/suat-chieu', () => {
    it('should allow STAFF to fetch paginated showtimes list', async () => {
      const res = await request(app)
        .get('/api/v1/staff/ban-ve/suat-chieu')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.pagination).toBeDefined();

      const sc = res.body.data[0];
      expect(sc.MaSuatChieu).toBe(showtime.MaSuatChieu);
      expect(sc.soGheTrong).toBe(3);
      expect(sc.soGheDaDat).toBe(0);
      expect(sc.soGheDangGiu).toBe(0);
    });

    it('should filter showtimes by movie title keyword', async () => {
      const res = await request(app)
        .get('/api/v1/staff/ban-ve/suat-chieu?keyword=POS')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);

      const resEmpty = await request(app)
        .get('/api/v1/staff/ban-ve/suat-chieu?keyword=NonExistentMovie')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(resEmpty.status).toBe(200);
      expect(resEmpty.body.data).toHaveLength(0);
    });

    it('should exclude past/started showtimes', async () => {
      // Create a past showtime
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 3);

      await prisma.suatChieu.create({
        data: {
          MaPhim: movie.MaPhim,
          MaPhong: showtime.MaPhong,
          MaLoaiNgay: showtime.MaLoaiNgay,
          NgayChieu: pastDate,
          GioChieu: pastDate,
          GiaVeGoc: 50000.0,
        },
      });

      const res = await request(app)
        .get('/api/v1/staff/ban-ve/suat-chieu')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      // Only the future showtime should be listed
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].MaSuatChieu).toBe(showtime.MaSuatChieu);
    });

    it('should correctly treat expired seat holds as TRONG', async () => {
      const pastTime = new Date(Date.now() - 1000); // expired 1s ago
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: pastTime,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const res = await request(app)
        .get('/api/v1/staff/ban-ve/suat-chieu')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      const sc = res.body.data[0];
      // seat1 should count as empty/trong since it is expired
      expect(sc.soGheTrong).toBe(3);
      expect(sc.soGheDangGiu).toBe(0);
    });
  });

  describe('🔍 Flow 2: GET /api/v1/staff/ban-ve/suat-chieu/:maSuatChieu/ghe', () => {
    it('should allow STAFF to fetch seat map with calculated prices and hide hold accounts', async () => {
      const res = await request(app)
        .get(`/api/v1/staff/ban-ve/suat-chieu/${showtime.MaSuatChieu}/ghe`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.Ghe).toHaveLength(3);

      const seatObj = res.body.data.Ghe[0];
      // Price: 50000 (base) + 10000 (room surcharge) + 5000 (day surcharge) + 0 (seat surcharge) = 65000
      expect(seatObj.GiaVeTinhToan).toBe(65000);
      expect(seatObj.MaTaiKhoanGiu).toBeUndefined();
    });

    it('should release expired holds when retrieving seat map', async () => {
      const pastTime = new Date(Date.now() - 10000);
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat2.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: pastTime,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const res = await request(app)
        .get(`/api/v1/staff/ban-ve/suat-chieu/${showtime.MaSuatChieu}/ghe`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      const updatedSeat2 = res.body.data.Ghe.find((s: any) => s.MaGheSuatChieu === seat2.MaGheSuatChieu);
      expect(updatedSeat2.TrangThai).toBe('TRONG');

      // Verify DB was also updated
      const dbSeat2 = await prisma.gheSuatChieu.findUnique({
        where: { MaGheSuatChieu: seat2.MaGheSuatChieu },
      });
      expect(dbSeat2?.TrangThai).toBe('TRONG');
      expect(dbSeat2?.ThoiGianGiuGhe).toBeNull();
      expect(dbSeat2?.MaTaiKhoanGiu).toBeNull();
    });
  });

  describe('🔒 Flow 3: POST /api/v1/staff/ban-ve/thanh-toan', () => {
    it('should complete sale at counter with TIEN_MAT payment', async () => {
      const res = await request(app)
        .post('/api/v1/staff/ban-ve/thanh-toan')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu, seat2.MaGheSuatChieu],
          PhuongThuc: 'TIEN_MAT',
          GhiChu: 'Bán tại quầy',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.MaPhieuDat).toBeDefined();
      expect(res.body.data.TongTien).toBe(130000); // 65000 * 2
      expect(res.body.data.TrangThai).toBe('DA_THANH_TOAN');
      expect(res.body.data.MaNhanVien).toBe(staffAccount.NhanVien.MaNhanVien);

      // Verify booking ticket details
      const ticket = await prisma.phieuDatVe.findUnique({
        where: { MaPhieuDat: res.body.data.MaPhieuDat },
        include: {
          ChiTietDatVes: true,
          GiaoDichs: true,
        },
      });

      expect(ticket).toBeDefined();
      expect(ticket?.MaKhachHang).toBeNull();
      expect(ticket?.MaNhanVien).toBe(staffAccount.NhanVien.MaNhanVien);
      expect(ticket?.ChiTietDatVes).toHaveLength(2);
      expect(ticket?.GiaoDichs).toHaveLength(1);
      expect(ticket?.GiaoDichs[0].PhuongThuc).toBe('TIEN_MAT');
      expect(ticket?.GiaoDichs[0].TrangThai).toBe('THANH_CONG');

      // Verify seats are updated to DA_DAT
      const dbSeat1 = await prisma.gheSuatChieu.findUnique({ where: { MaGheSuatChieu: seat1.MaGheSuatChieu } });
      const dbSeat2 = await prisma.gheSuatChieu.findUnique({ where: { MaGheSuatChieu: seat2.MaGheSuatChieu } });
      expect(dbSeat1?.TrangThai).toBe('DA_DAT');
      expect(dbSeat1?.ThoiGianGiuGhe).toBeNull();
      expect(dbSeat1?.MaTaiKhoanGiu).toBeNull();
      expect(dbSeat2?.TrangThai).toBe('DA_DAT');
    });

    it('should complete sale at counter with CHUYEN_KHOAN payment and provided external code', async () => {
      const res = await request(app)
        .post('/api/v1/staff/ban-ve/thanh-toan')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat3.MaGheSuatChieu],
          PhuongThuc: 'CHUYEN_KHOAN',
          MaGiaoDichNgoai: 'BANK_123456',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.GiaoDich.PhuongThuc).toBe('CHUYEN_KHOAN');
      expect(res.body.data.GiaoDich.MaGiaoDichNgoai).toBe('BANK_123456');
    });

    it('should fail if seats are already DA_DAT', async () => {
      // Sell seat1 first
      await request(app)
        .post('/api/v1/staff/ban-ve/thanh-toan')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
          PhuongThuc: 'TIEN_MAT',
        });

      // Try selling it again
      const res = await request(app)
        .post('/api/v1/staff/ban-ve/thanh-toan')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
          PhuongThuc: 'TIEN_MAT',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Ghế đã được đặt hoặc đang được giữ');
    });

    it('should fail if seats are actively held by another customer', async () => {
      // Put an active hold on seat2
      const futureHold = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat2.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: futureHold,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const res = await request(app)
        .post('/api/v1/staff/ban-ve/thanh-toan')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat2.MaGheSuatChieu],
          PhuongThuc: 'TIEN_MAT',
        });

      expect(res.status).toBe(400);
    });

    it('should succeed if seat hold is expired (releases and purchases it)', async () => {
      // Put an expired hold on seat3
      const expiredHold = new Date(Date.now() - 5000);
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat3.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: expiredHold,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const res = await request(app)
        .post('/api/v1/staff/ban-ve/thanh-toan')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat3.MaGheSuatChieu],
          PhuongThuc: 'TIEN_MAT',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbSeat3 = await prisma.gheSuatChieu.findUnique({ where: { MaGheSuatChieu: seat3.MaGheSuatChieu } });
      expect(dbSeat3?.TrangThai).toBe('DA_DAT');
    });
  });

  describe('🛡️ Role blocking checks', () => {
    const endpoints = [
      { method: 'get', url: '/api/v1/staff/ban-ve/suat-chieu' },
      { method: 'get', url: `/api/v1/staff/ban-ve/suat-chieu/SOME_UUID/ghe` },
      { method: 'post', url: '/api/v1/staff/ban-ve/thanh-toan', body: {} },
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
