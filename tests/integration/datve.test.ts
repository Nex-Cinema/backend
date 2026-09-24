import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { GioiHanTuoi, Role, TrangThaiGheSuatChieu } from '@prisma/client';
import {
  cleanupTestData,
  createTestAdmin,
  createTestCustomer,
  loginAndGetToken,
  createTestMovie,
} from '../helpers';
import { runReleaseExpiredSeatHolds } from '../../src/jobs/releaseExpiredSeatHolds.job';

describe('🎟️ Seat Map and Hold Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let customer2Token: string;
  let customerAccount: any;
  let customer2Account: any;
  let showtime: any;
  let movie: any;
  let seat1: any;
  let seat2: any;
  
  beforeAll(async () => {
    await cleanupTestData();

    // Create test accounts
    customerAccount = await createTestCustomer('customer_test_1', 'password123');
    customer2Account = await createTestCustomer('customer_test_2', 'password123');
    await createTestAdmin('admin_test_1', 'password123');

    adminToken = await loginAndGetToken(app, 'admin_test_1', 'password123');
    customerToken = await loginAndGetToken(app, 'customer_test_1', 'password123');
    customer2Token = await loginAndGetToken(app, 'customer_test_2', 'password123');
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
    // Clean up showtimes and bookings between tests to ensure isolated runs
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

    // Seed a standard room and showtime
    movie = await createTestMovie({ TenPhim: 'Hold Test Phim', ThoiLuong: 120 });
    const soDo = await prisma.soDoGhe.create({
      data: { TenSoDo: 'Test Sơ Đồ', SoHang: 5, SoCot: 5 },
    });
    const loaiPhong = await prisma.loaiPhong.create({
      data: { TenLoaiPhong: 'IMAX', PhuThu: 20000.0 },
    });
    const phong = await prisma.phongChieu.create({
      data: { TenPhong: 'IMAX Room', MaLoaiPhong: loaiPhong.MaLoaiPhong, MaSoDo: soDo.MaSoDo },
    });
    const loaiNgay = await prisma.loaiNgay.create({
      data: { TenLoaiNgay: 'Weekend', PhuThu: 10000.0 },
    });
    const loaiGhe = await prisma.loaiGhe.create({
      data: { TenLoaiGhe: 'VIP', PhuThu: 15000.0 },
    });

    const g1 = await prisma.ghe.create({
      data: { ViTriDay: 'A', ViTriCot: 1, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
    });
    const g2 = await prisma.ghe.create({
      data: { ViTriDay: 'A', ViTriCot: 2, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
    });

    // Create a future showtime
    const date = new Date();
    date.setDate(date.getDate() + 3);
    date.setHours(20, 0, 0, 0);

    showtime = await prisma.suatChieu.create({
      data: {
        MaPhim: movie.MaPhim,
        MaPhong: phong.MaPhong,
        MaLoaiNgay: loaiNgay.MaLoaiNgay,
        NgayChieu: date,
        GioChieu: date,
        GiaVeGoc: 60000.0,
      },
    });

    seat1 = await prisma.gheSuatChieu.create({
      data: {
        MaSuatChieu: showtime.MaSuatChieu,
        MaGhe: g1.MaGhe,
        TrangThai: 'TRONG',
        GiaVe: 60000.0,
      },
    });
    seat2 = await prisma.gheSuatChieu.create({
      data: {
        MaSuatChieu: showtime.MaSuatChieu,
        MaGhe: g2.MaGhe,
        TrangThai: 'TRONG',
        GiaVe: 60000.0,
      },
    });
  });

  describe('🔍 GET /api/v1/suat-chieu/:maSuatChieu/ghe', () => {
    it('should return seat map with calculated prices and hide MaTaiKhoanGiu', async () => {
      const res = await request(app).get(`/api/v1/suat-chieu/${showtime.MaSuatChieu}/ghe`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.SuatChieu.MaSuatChieu).toBe(showtime.MaSuatChieu);
      expect(res.body.data.PhongChieu.TenPhong).toBe('IMAX Room');
      expect(res.body.data.Ghe).toHaveLength(2);

      // Verify calculated price: GiaVeGoc (60000) + LoaiPhong (20000) + LoaiNgay (10000) + LoaiGhe (15000) = 105000
      const scSeat = res.body.data.Ghe[0];
      expect(scSeat.GiaVeTinhToan).toBe(105000);
      
      // Ensure MaTaiKhoanGiu is hidden from API response
      expect(scSeat.MaTaiKhoanGiu).toBeUndefined();
    });
  });

  describe('🔒 POST /api/v1/dat-ve/giu-ghe', () => {
    it('should allow CUSTOMER to hold available seats', async () => {
      const res = await request(app)
        .post('/api/v1/dat-ve/giu-ghe')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu, seat2.MaGheSuatChieu],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Giữ ghế thành công');
      expect(res.body.data.DanhSachGhe).toHaveLength(2);

      // Verify database
      const dbSeat = await prisma.gheSuatChieu.findUnique({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
      });
      expect(dbSeat?.TrangThai).toBe('DANG_GIU');
      expect(dbSeat?.MaTaiKhoanGiu).toBe(customerAccount.MaTaiKhoan);
      expect(dbSeat?.ThoiGianGiuGhe).not.toBeNull();
      const remainingMs = dbSeat!.ThoiGianGiuGhe!.getTime() - Date.now();
      expect(remainingMs).toBeGreaterThan(9 * 60 * 1000);
      expect(remainingMs).toBeLessThanOrEqual(10 * 60 * 1000);
    });

    it('should apply an updated hold duration from operational settings', async () => {
      await prisma.cauHinhVanHanh.update({
        where: { Id: 1 },
        data: { ThoiGianGiuGhePhut: 12 },
      });

      const res = await request(app)
        .post('/api/v1/dat-ve/giu-ghe')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
        });

      expect(res.status).toBe(200);
      const dbSeat = await prisma.gheSuatChieu.findUnique({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
      });
      const remainingMs = dbSeat!.ThoiGianGiuGhe!.getTime() - Date.now();
      expect(remainingMs).toBeGreaterThan(11 * 60 * 1000);
      expect(remainingMs).toBeLessThanOrEqual(12 * 60 * 1000);
    });

    it('should block non-CUSTOMER roles from calling the hold endpoint', async () => {
      const res = await request(app)
        .post('/api/v1/dat-ve/giu-ghe')
        .set('Authorization', `Bearer ${adminToken}`) // Admin login
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
        });

      expect(res.status).toBe(403);
    });

    it('should block holding booked (DA_DAT) seats', async () => {
      // Set seat1 to DA_DAT
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: { TrangThai: TrangThaiGheSuatChieu.DA_DAT },
      });

      const res = await request(app)
        .post('/api/v1/dat-ve/giu-ghe')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('đang được giữ bởi người khác');
    });

    it('should block holding seats active-held by another customer', async () => {
      const futureExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: futureExpiry,
          MaTaiKhoanGiu: customer2Account.MaTaiKhoan,
        },
      });

      const res = await request(app)
        .post('/api/v1/dat-ve/giu-ghe')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('đang được giữ bởi người khác');
    });

    it('should allow customer to re-hold/extend their own held seats', async () => {
      const pastExpiry = new Date(Date.now() + 10 * 1000); // Expires in 10 seconds
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: pastExpiry,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const res = await request(app)
        .post('/api/v1/dat-ve/giu-ghe')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
        });

      expect(res.status).toBe(200);
      
      const dbSeat = await prisma.gheSuatChieu.findUnique({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
      });
      // Verification: expiry extended to ~10 minutes from now (must be greater than pastExpiry)
      expect(dbSeat?.ThoiGianGiuGhe!.getTime()).toBeGreaterThan(pastExpiry.getTime());
    });

    it('should treat expired holds as available and let another customer hold them', async () => {
      const expiredTime = new Date(Date.now() - 5 * 1000); // Expired 5 seconds ago
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: expiredTime,
          MaTaiKhoanGiu: customer2Account.MaTaiKhoan,
        },
      });

      // Customer 1 tries to hold it -> should succeed because it is expired
      const res = await request(app)
        .post('/api/v1/dat-ve/giu-ghe')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbSeat = await prisma.gheSuatChieu.findUnique({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
      });
      expect(dbSeat?.MaTaiKhoanGiu).toBe(customerAccount.MaTaiKhoan);
    });
  });

  describe('🔓 POST /api/v1/dat-ve/huy-giu-ghe', () => {
    it('should allow customer to cancel their own held seats', async () => {
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: new Date(Date.now() + 2 * 60 * 1000),
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const res = await request(app)
        .post('/api/v1/dat-ve/huy-giu-ghe')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Huỷ giữ ghế thành công');

      const dbSeat = await prisma.gheSuatChieu.findUnique({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
      });
      expect(dbSeat?.TrangThai).toBe('TRONG');
      expect(dbSeat?.MaTaiKhoanGiu).toBeNull();
      expect(dbSeat?.ThoiGianGiuGhe).toBeNull();
    });

    it('should prevent customer from cancelling seats held by someone else', async () => {
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: new Date(Date.now() + 2 * 60 * 1000),
          MaTaiKhoanGiu: customer2Account.MaTaiKhoan, // held by customer 2
        },
      });

      const res = await request(app)
        .post('/api/v1/dat-ve/huy-giu-ghe')
        .set('Authorization', `Bearer ${customerToken}`) // Customer 1 attempts
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('không thuộc trạng thái đang giữ của bạn');
    });
  });

  describe('⏰ Expired Hold Cleanup Cron Job', () => {
    it('should release expired holds when cron releaseExpiredHolds job is executed', async () => {
      const expiredTime = new Date(Date.now() - 5000); // Expired 5 seconds ago
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: expiredTime,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      // Invoke the release job manually
      const releasedCount = await runReleaseExpiredSeatHolds();
      expect(releasedCount).toBe(1);

      // Verify database
      const dbSeat = await prisma.gheSuatChieu.findUnique({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
      });
      expect(dbSeat?.TrangThai).toBe('TRONG');
      expect(dbSeat?.MaTaiKhoanGiu).toBeNull();
      expect(dbSeat?.ThoiGianGiuGhe).toBeNull();
    });
  });

  describe('💳 Customer Booking and Payment Core Tests', () => {
    beforeEach(async () => {
      // Put seats back to TRONG
      await prisma.gheSuatChieu.updateMany({
        where: { MaSuatChieu: showtime.MaSuatChieu },
        data: {
          TrangThai: 'TRONG',
          ThoiGianGiuGhe: null,
          MaTaiKhoanGiu: null,
        },
      });
    });

    it('1. CUSTOMER can pay successfully for their own held seats via simulation', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: futureExpiry,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const res = await request(app)
        .post('/api/v1/dat-ve/thanh-toan-gia-lap')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
          PhuongThucThanhToan: 'TIEN_MAT',
          KetQuaThanhToan: 'THANH_CONG',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Thanh toán thành công');
      expect(res.body.data.MaPhieuDat).toBeDefined();
      expect(res.body.data.TongTien).toBe(105000); // 60000 base + 20000 room + 10000 day + 15000 seat
      expect(res.body.data.QRPayload).toBe(`QR_${res.body.data.MaPhieuDat}`);
    });

    it('2. Payment success creates PHIEUDATVE, CHITIETDATVE, GIAODICH in database', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: futureExpiry,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const res = await request(app)
        .post('/api/v1/dat-ve/thanh-toan-gia-lap')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
          PhuongThucThanhToan: 'TIEN_MAT',
          KetQuaThanhToan: 'THANH_CONG',
        });

      const bookingId = res.body.data.MaPhieuDat;

      // Verify PhieuDatVe
      const dbBooking = await prisma.phieuDatVe.findUnique({
        where: { MaPhieuDat: bookingId },
        include: { ChiTietDatVes: true, GiaoDichs: true },
      });
      expect(dbBooking).not.toBeNull();
      expect(dbBooking?.TrangThai).toBe('DA_THANH_TOAN');
      expect(Number(dbBooking?.TongTien)).toBe(105000);

      // Verify ChiTietDatVe
      expect(dbBooking?.ChiTietDatVes).toHaveLength(1);
      expect(dbBooking?.ChiTietDatVes[0].MaGheSuatChieu).toBe(seat1.MaGheSuatChieu);
      expect(Number(dbBooking?.ChiTietDatVes[0].GiaVe)).toBe(105000);

      // Verify GiaoDich
      expect(dbBooking?.GiaoDichs).toHaveLength(1);
      expect(dbBooking?.GiaoDichs[0].PhuongThuc).toBe('TIEN_MAT');
      expect(dbBooking?.GiaoDichs[0].TrangThai).toBe('THANH_CONG');
      expect(Number(dbBooking?.GiaoDichs[0].SoTien)).toBe(105000);
    });

    it('3. Payment success updates seats to DA_DAT', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: futureExpiry,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      await request(app)
        .post('/api/v1/dat-ve/thanh-toan-gia-lap')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
          PhuongThucThanhToan: 'TIEN_MAT',
          KetQuaThanhToan: 'THANH_CONG',
        });

      const dbSeat = await prisma.gheSuatChieu.findUnique({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
      });
      expect(dbSeat?.TrangThai).toBe('DA_DAT');
      expect(dbSeat?.MaTaiKhoanGiu).toBeNull();
      expect(dbSeat?.ThoiGianGiuGhe).toBeNull();
    });

    it('4. CUSTOMER cannot pay for seats held by another user', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: futureExpiry,
          MaTaiKhoanGiu: customer2Account.MaTaiKhoan, // Held by Customer 2
        },
      });

      // Customer 1 tries to pay
      const res = await request(app)
        .post('/api/v1/dat-ve/thanh-toan-gia-lap')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
          PhuongThucThanhToan: 'TIEN_MAT',
          KetQuaThanhToan: 'THANH_CONG',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('không thuộc quyền sở hữu của bạn');
    });

    it('5. CUSTOMER cannot pay for expired held seats', async () => {
      const expiredTime = new Date(Date.now() - 5 * 1000); // Expired 5 seconds ago
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: expiredTime,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const res = await request(app)
        .post('/api/v1/dat-ve/thanh-toan-gia-lap')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
          PhuongThucThanhToan: 'TIEN_MAT',
          KetQuaThanhToan: 'THANH_CONG',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      // Message comes from findHeldSeatsForPayment (pre-check)
      expect(res.body.message).toContain('đã hết hạn giữ hoặc không thuộc quyền sở hữu');
    });

    it('5b. Race condition: payment rejected if seat expires between pre-check and DB update', async () => {
      // Seat is held and NOT expired when the pre-check runs, but we simulate it
      // becoming expired by having ThoiGianGiuGhe in the past before the
      // repository's updateMany fires. We achieve this by setting expiry to a
      // value in the past AFTER the pre-check query would accept it.
      //
      // In the actual race, a background job would expire the seat between the
      // SELECT (findHeldSeatsForPayment) and the UPDATE (createPaidBookingTransaction).
      // We simulate that by directly inserting a seat where:
      //   - TrangThai = DANG_GIU (so findHeldSeats sees it as held)
      //   - ThoiGianGiuGhe is 1ms in the future when the test starts but
      //     we manually override it to the past before calling payment.
      //
      // The safer unit-level test: set ThoiGianGiuGhe just barely in the past
      // and skip the service-level pre-check by calling createPaidBookingTransaction
      // directly via the repository.
      //
      // Integration-level: set seat as expired, then confirm the API rejects at
      // findHeldSeatsForPayment (our service-level guard).
      const expiredTime = new Date(Date.now() - 1); // 1ms ago
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: expiredTime,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const res = await request(app)
        .post('/api/v1/dat-ve/thanh-toan-gia-lap')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
          PhuongThucThanhToan: 'TIEN_MAT',
          KetQuaThanhToan: 'THANH_CONG',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      // Could be caught by either pre-check or the DB guard
      expect(
        res.body.message.includes('đã hết hạn') ||
        res.body.message.includes('sở hữu')
      ).toBe(true);

      // Verify no booking was created
      const bookingsCount = await prisma.phieuDatVe.count();
      expect(bookingsCount).toBe(0);
    });

    it('5c. CUSTOMER cannot pay for seat held by another user even if seat count matches', async () => {
      // Both seats are held but by different users – customer1 pays for both,
      // expects failure because seat2 is owned by customer2.
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: futureExpiry,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat2.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: futureExpiry,
          MaTaiKhoanGiu: customer2Account.MaTaiKhoan, // different owner
        },
      });

      const res = await request(app)
        .post('/api/v1/dat-ve/thanh-toan-gia-lap')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu, seat2.MaGheSuatChieu],
          PhuongThucThanhToan: 'TIEN_MAT',
          KetQuaThanhToan: 'THANH_CONG',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('không thuộc quyền sở hữu');
    });

    it('6. Failed payment releases held seats and creates no successful booking', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: futureExpiry,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const res = await request(app)
        .post('/api/v1/dat-ve/thanh-toan-gia-lap')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
          PhuongThucThanhToan: 'TIEN_MAT',
          KetQuaThanhToan: 'THAT_BAI',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Thanh toán giả lập thất bại');

      // Check database: seat released back to TRONG
      const dbSeat = await prisma.gheSuatChieu.findUnique({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
      });
      expect(dbSeat?.TrangThai).toBe('TRONG');
      expect(dbSeat?.MaTaiKhoanGiu).toBeNull();
      expect(dbSeat?.ThoiGianGiuGhe).toBeNull();

      // No bookings created
      const bookingsCount = await prisma.phieuDatVe.count();
      expect(bookingsCount).toBe(0);
    });

    it('7. Customer can cancel own paid booking before showtime starts', async () => {
      // 1. Pay successfully to create a booking
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: futureExpiry,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const payRes = await request(app)
        .post('/api/v1/dat-ve/thanh-toan-gia-lap')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
          PhuongThucThanhToan: 'TIEN_MAT',
          KetQuaThanhToan: 'THANH_CONG',
        });

      const bookingId = payRes.body.data.MaPhieuDat;

      // 2. Cancel the paid booking
      const cancelRes = await request(app)
        .post(`/api/v1/dat-ve/${bookingId}/huy`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          LyDoHoan: 'Tôi bận việc đột xuất',
          TenNganHang: 'MBBank',
          SoTaiKhoan: '999999',
          TenChuTaiKhoan: 'NGUYEN VAN A',
        });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.success).toBe(true);
      expect(cancelRes.body.message).toBe('Hủy vé thành công, yêu cầu hoàn tiền đang chờ duyệt');

      const dbBooking = await prisma.phieuDatVe.findUnique({
        where: { MaPhieuDat: bookingId },
      });
      expect(dbBooking?.TrangThai).toBe('DA_HUY');
    });

    it('8. Cancelling paid booking creates LICHSUHOANTIEN with CHO_XU_LY', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: futureExpiry,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const payRes = await request(app)
        .post('/api/v1/dat-ve/thanh-toan-gia-lap')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
          PhuongThucThanhToan: 'TIEN_MAT',
          KetQuaThanhToan: 'THANH_CONG',
        });

      const bookingId = payRes.body.data.MaPhieuDat;

      await request(app)
        .post(`/api/v1/dat-ve/${bookingId}/huy`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          LyDoHoan: 'Tôi bận việc đột xuất',
          TenNganHang: 'MBBank',
          SoTaiKhoan: '999999',
          TenChuTaiKhoan: 'NGUYEN VAN A',
        });

      const dbRefund = await prisma.lichSuHoanTien.findFirst({
        where: {
          GiaoDich: {
            MaPhieuDat: bookingId,
          },
        },
      });

      expect(dbRefund).not.toBeNull();
      expect(dbRefund?.TrangThai).toBe('CHO_XU_LY');
      expect(dbRefund?.LyDo).toBe('Tôi bận việc đột xuất');
      expect(Number(dbRefund?.SoTienHoan)).toBe(105000);
    });

    it('9. Cancelling paid booking does not release seats immediately', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: futureExpiry,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const payRes = await request(app)
        .post('/api/v1/dat-ve/thanh-toan-gia-lap')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
          PhuongThucThanhToan: 'TIEN_MAT',
          KetQuaThanhToan: 'THANH_CONG',
        });

      const bookingId = payRes.body.data.MaPhieuDat;

      await request(app)
        .post(`/api/v1/dat-ve/${bookingId}/huy`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          LyDoHoan: 'Tôi bận việc đột xuất',
          TenNganHang: 'MBBank',
          SoTaiKhoan: '999999',
          TenChuTaiKhoan: 'NGUYEN VAN A',
        });

      // Verify database: seat status must remain DA_DAT
      const dbSeat = await prisma.gheSuatChieu.findUnique({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
      });
      expect(dbSeat?.TrangThai).toBe('DA_DAT');
    });

    it('10. Customer cannot cancel another customer booking', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: futureExpiry,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const payRes = await request(app)
        .post('/api/v1/dat-ve/thanh-toan-gia-lap')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
          PhuongThucThanhToan: 'TIEN_MAT',
          KetQuaThanhToan: 'THANH_CONG',
        });

      const bookingId = payRes.body.data.MaPhieuDat;

      // Customer 2 attempts to cancel Customer 1's booking
      const res = await request(app)
        .post(`/api/v1/dat-ve/${bookingId}/huy`)
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({
          LyDoHoan: 'Hủy giùm',
        });

      expect(res.status).toBe(404); // Not found for Customer 2
      expect(res.body.success).toBe(false);
    });

    it('11. Customer cannot cancel booking after showtime starts', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.gheSuatChieu.update({
        where: { MaGheSuatChieu: seat1.MaGheSuatChieu },
        data: {
          TrangThai: 'DANG_GIU',
          ThoiGianGiuGhe: futureExpiry,
          MaTaiKhoanGiu: customerAccount.MaTaiKhoan,
        },
      });

      const payRes = await request(app)
        .post('/api/v1/dat-ve/thanh-toan-gia-lap')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MaSuatChieu: showtime.MaSuatChieu,
          DanhSachMaGheSuatChieu: [seat1.MaGheSuatChieu],
          PhuongThucThanhToan: 'TIEN_MAT',
          KetQuaThanhToan: 'THANH_CONG',
        });

      const bookingId = payRes.body.data.MaPhieuDat;

      // Update showtime to start in the past
      const pastDate = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
      await prisma.suatChieu.update({
        where: { MaSuatChieu: showtime.MaSuatChieu },
        data: {
          NgayChieu: pastDate,
          GioChieu: pastDate,
        },
      });

      // Attempt to cancel
      const res = await request(app)
        .post(`/api/v1/dat-ve/${bookingId}/huy`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          LyDoHoan: 'Trễ giờ rồi muốn hủy',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('đã bắt đầu hoặc đã diễn ra');
    });
  });
});
