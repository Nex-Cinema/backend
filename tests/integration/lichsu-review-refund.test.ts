import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { GioiHanTuoi, Role } from '@prisma/client';
import {
  cleanupTestData,
  createTestAdmin,
  createTestCustomer,
  loginAndGetToken,
  createTestMovie,
} from '../helpers';

describe('💳 Customer History, Reviews, and Refund Requests Integration Tests', () => {
  let customer1Token: string;
  let customer2Token: string;
  let customer1Account: any;
  let customer2Account: any;
  let movie: any;
  let showtime: any;
  let seat1: any;
  let seat2: any;

  beforeAll(async () => {
    await cleanupTestData();

    // Create test accounts
    customer1Account = await createTestCustomer('customer_h_1', 'password123');
    customer2Account = await createTestCustomer('customer_h_2', 'password123');

    // Fetch KhachHang profile to have it attached
    const kh1 = await prisma.khachHang.findUnique({ where: { MaTaiKhoan: customer1Account.MaTaiKhoan } });
    const kh2 = await prisma.khachHang.findUnique({ where: { MaTaiKhoan: customer2Account.MaTaiKhoan } });
    customer1Account.KhachHang = kh1;
    customer2Account.KhachHang = kh2;

    customer1Token = await loginAndGetToken(app, 'customer_h_1', 'password123');
    customer2Token = await loginAndGetToken(app, 'customer_h_2', 'password123');
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Isolated cleanup of bookings/movies/rooms
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

    // Seed standard showtime & room
    movie = await createTestMovie({ TenPhim: 'History Phim', ThoiLuong: 120 });
    const soDo = await prisma.soDoGhe.create({
      data: { TenSoDo: 'Sơ đồ test', SoHang: 5, SoCot: 5 },
    });
    const loaiPhong = await prisma.loaiPhong.create({
      data: { TenLoaiPhong: 'Standard', PhuThu: 0.0 },
    });
    const phong = await prisma.phongChieu.create({
      data: { TenPhong: 'Room 1', MaLoaiPhong: loaiPhong.MaLoaiPhong, MaSoDo: soDo.MaSoDo },
    });
    const loaiNgay = await prisma.loaiNgay.create({
      data: { TenLoaiNgay: 'Weekday', PhuThu: 0.0 },
    });
    const loaiGhe = await prisma.loaiGhe.create({
      data: { TenLoaiGhe: 'Normal', PhuThu: 0.0 },
    });

    const g1 = await prisma.ghe.create({
      data: { ViTriDay: 'A', ViTriCot: 1, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
    });
    const g2 = await prisma.ghe.create({
      data: { ViTriDay: 'A', ViTriCot: 2, MaPhong: phong.MaPhong, MaLoaiGhe: loaiGhe.MaLoaiGhe },
    });

    const date = new Date();
    date.setDate(date.getDate() + 2); // 2 days in the future
    date.setHours(19, 0, 0, 0);

    showtime = await prisma.suatChieu.create({
      data: {
        MaPhim: movie.MaPhim,
        MaPhong: phong.MaPhong,
        MaLoaiNgay: loaiNgay.MaLoaiNgay,
        NgayChieu: date,
        GioChieu: date,
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
  });

  describe('🔍 Booking History (Lịch sử giao dịch)', () => {
    it('1. Customer can view only their own booking history', async () => {
      // Create a booking for Customer 1
      const booking = await prisma.phieuDatVe.create({
        data: {
          MaKhachHang: customer1Account.KhachHang.MaKhachHang,
          TongTien: 50000.0,
          TrangThai: 'DA_THANH_TOAN',
          ChiTietDatVes: {
            create: {
              MaGheSuatChieu: seat1.MaGheSuatChieu,
              GiaVe: 50000.0,
            },
          },
        },
      });

      // Customer 1 calls GET /lich-su-giao-dich
      const res1 = await request(app)
        .get('/api/v1/lich-su-giao-dich')
        .set('Authorization', `Bearer ${customer1Token}`);

      expect(res1.status).toBe(200);
      expect(res1.body.data).toHaveLength(1);
      expect(res1.body.data[0].MaPhieuDat).toBe(booking.MaPhieuDat);

      // Customer 2 calls GET /lich-su-giao-dich -> should be empty
      const res2 = await request(app)
        .get('/api/v1/lich-su-giao-dich')
        .set('Authorization', `Bearer ${customer2Token}`);

      expect(res2.status).toBe(200);
      expect(res2.body.data).toHaveLength(0);
    });

    it("2. Customer cannot view another customer's booking detail", async () => {
      // Create booking for Customer 1
      const booking = await prisma.phieuDatVe.create({
        data: {
          MaKhachHang: customer1Account.KhachHang.MaKhachHang,
          TongTien: 50000.0,
          TrangThai: 'DA_THANH_TOAN',
        },
      });

      // Customer 2 requests Customer 1's booking details -> should fail (404/Forbidden)
      const res = await request(app)
        .get(`/api/v1/lich-su-giao-dich/${booking.MaPhieuDat}`)
        .set('Authorization', `Bearer ${customer2Token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('3. History detail includes tickets, seats, movie, showtime, room, transactions', async () => {
      const booking = await prisma.phieuDatVe.create({
        data: {
          MaKhachHang: customer1Account.KhachHang.MaKhachHang,
          TongTien: 50000.0,
          TrangThai: 'DA_THANH_TOAN',
          ChiTietDatVes: {
            create: {
              MaGheSuatChieu: seat1.MaGheSuatChieu,
              GiaVe: 50000.0,
            },
          },
          GiaoDichs: {
            create: {
              PhuongThuc: 'VNPAY',
              SoTien: 50000.0,
              TrangThai: 'THANH_CONG',
              MaGiaoDichNgoai: 'REF_TEST_123',
            },
          },
        },
      });

      const res = await request(app)
        .get(`/api/v1/lich-su-giao-dich/${booking.MaPhieuDat}`)
        .set('Authorization', `Bearer ${customer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.MaPhieuDat).toBe(booking.MaPhieuDat);
      expect(res.body.data.ChiTietDatVes).toHaveLength(1);
      
      const details = res.body.data.ChiTietDatVes[0];
      expect(details.Ghe.TenGhe).toBe('A1');
      expect(details.SuatChieu.Phim.TenPhim).toBe('History Phim');
      expect(details.SuatChieu.PhongChieu.TenPhong).toBe('Room 1');
      
      expect(res.body.data.GiaoDichs).toHaveLength(1);
      expect(res.body.data.GiaoDichs[0].PhuongThuc).toBe('VNPAY');
    });
  });

  describe('⭐ Movie Reviews (Đánh giá phim)', () => {
    it('4. Customer can create multiple reviews for same movie', async () => {
      // Review 1
      const res1 = await request(app)
        .post('/api/v1/danh-gia')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          MaPhim: movie.MaPhim,
          SoSao: 5,
          BinhLuan: 'Phim hay quá lần 1!',
        });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);

      // Review 2
      const res2 = await request(app)
        .post('/api/v1/danh-gia')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          MaPhim: movie.MaPhim,
          SoSao: 4,
          BinhLuan: 'Xem lại vẫn thấy hay!',
        });

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);

      const count = await prisma.danhGia.count({
        where: { MaPhim: movie.MaPhim },
      });
      expect(count).toBe(2);
    });

    it('5. Review requires SoSao from 1 to 5', async () => {
      // Rating 0 should fail
      const res0 = await request(app)
        .post('/api/v1/danh-gia')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          MaPhim: movie.MaPhim,
          SoSao: 0,
        });

      expect(res0.status).toBe(422);

      // Rating 6 should fail
      const res6 = await request(app)
        .post('/api/v1/danh-gia')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          MaPhim: movie.MaPhim,
          SoSao: 6,
        });

      expect(res6.status).toBe(422);
    });

    it('6. Public can view movie reviews without auth', async () => {
      // Create a review
      await prisma.danhGia.create({
        data: {
          MaKhachHang: customer1Account.KhachHang.MaKhachHang,
          MaPhim: movie.MaPhim,
          SoSao: 5,
          BinhLuan: 'Review công khai',
        },
      });

      const res = await request(app).get(`/api/v1/phim/${movie.MaPhim}/danh-gia`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.ratingSummary.DiemTrungBinh).toBe(5);
      expect(res.body.ratingSummary.SoLuongDanhGia).toBe(1);
    });

    it('7. Movie reviews do not expose customer email or phone', async () => {
      await prisma.danhGia.create({
        data: {
          MaKhachHang: customer1Account.KhachHang.MaKhachHang,
          MaPhim: movie.MaPhim,
          SoSao: 5,
          BinhLuan: 'Ẩn thông tin nhạy cảm',
        },
      });

      const res = await request(app).get(`/api/v1/phim/${movie.MaPhim}/danh-gia`);

      const review = res.body.data[0];
      expect(review.KhachHang.HoTen).toBe('Test Customer');
      expect(review.KhachHang.Email).toBeUndefined();
      expect(review.KhachHang.SoDienThoai).toBeUndefined();
    });
  });

  describe('💸 Refund Requests (Hoàn tiền)', () => {
    let booking: any;
    let gd: any;

    beforeEach(async () => {
      // Create paid booking for Customer 1
      booking = await prisma.phieuDatVe.create({
        data: {
          MaKhachHang: customer1Account.KhachHang.MaKhachHang,
          TongTien: 100000.0,
          TrangThai: 'DA_THANH_TOAN',
          ChiTietDatVes: {
            create: [
              { MaGheSuatChieu: seat1.MaGheSuatChieu, GiaVe: 50000.0 },
              { MaGheSuatChieu: seat2.MaGheSuatChieu, GiaVe: 50000.0 },
            ],
          },
        },
      });

      gd = await prisma.giaoDich.create({
        data: {
          MaPhieuDat: booking.MaPhieuDat,
          PhuongThuc: 'VNPAY',
          SoTien: 100000.0,
          TrangThai: 'THANH_CONG',
          MaGiaoDichNgoai: 'MOCK_REF_111',
        },
      });

      // Update seats to DA_DAT
      await prisma.gheSuatChieu.updateMany({
        where: { MaGheSuatChieu: { in: [seat1.MaGheSuatChieu, seat2.MaGheSuatChieu] } },
        data: { TrangThai: 'DA_DAT' },
      });
    });

    it('8. Customer can request refund for own paid/cancelled booking', async () => {
      const res = await request(app)
        .post('/api/v1/hoan-tien/yeu-cau')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          MaPhieuDat: booking.MaPhieuDat,
          LyDo: 'Tôi có việc khẩn cấp',
          TenNganHang: 'MBBank',
          SoTaiKhoan: '999999',
          TenChuTaiKhoan: 'NGUYEN VAN A',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.SoTienHoan).toBe(100000);
      expect(res.body.data.TrangThai).toBe('CHO_XU_LY');

      // Verify booking status transitioned to DA_HUY
      const dbBooking = await prisma.phieuDatVe.findUnique({
        where: { MaPhieuDat: booking.MaPhieuDat },
      });
      expect(dbBooking?.TrangThai).toBe('DA_HUY');
    });

    it('9. Duplicate pending refund request is blocked', async () => {
      // First request
      await request(app)
        .post('/api/v1/hoan-tien/yeu-cau')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          MaPhieuDat: booking.MaPhieuDat,
          LyDo: 'Hủy lần 1',
          TenNganHang: 'MBBank',
          SoTaiKhoan: '999999',
          TenChuTaiKhoan: 'NGUYEN VAN A',
        });

      // Second request -> should block
      const res = await request(app)
        .post('/api/v1/hoan-tien/yeu-cau')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          MaPhieuDat: booking.MaPhieuDat,
          LyDo: 'Hủy lần 2',
          TenNganHang: 'MBBank',
          SoTaiKhoan: '999999',
          TenChuTaiKhoan: 'NGUYEN VAN A',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/đang (được|chờ) xử lý/);
    });

    it('10. Refund request does not release seats', async () => {
      await request(app)
        .post('/api/v1/hoan-tien/yeu-cau')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          MaPhieuDat: booking.MaPhieuDat,
          LyDo: 'Hủy vé không nhường ghế ngay',
          TenNganHang: 'MBBank',
          SoTaiKhoan: '999999',
          TenChuTaiKhoan: 'NGUYEN VAN A',
        });

      // Seats must remain DA_DAT
      const seats = await prisma.gheSuatChieu.findMany({
        where: { MaGheSuatChieu: { in: [seat1.MaGheSuatChieu, seat2.MaGheSuatChieu] } },
      });
      expect(seats[0].TrangThai).toBe('DA_DAT');
      expect(seats[1].TrangThai).toBe('DA_DAT');
    });

    it('11. Customer can view only their own refund requests', async () => {
      await request(app)
        .post('/api/v1/hoan-tien/yeu-cau')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          MaPhieuDat: booking.MaPhieuDat,
          LyDo: 'Xem danh sách hoàn tiền',
          TenNganHang: 'MBBank',
          SoTaiKhoan: '999999',
          TenChuTaiKhoan: 'NGUYEN VAN A',
        });

      // Customer 1 should see 1 request
      const res1 = await request(app)
        .get('/api/v1/hoan-tien/cua-toi')
        .set('Authorization', `Bearer ${customer1Token}`);

      expect(res1.status).toBe(200);
      expect(res1.body.data).toHaveLength(1);
      expect(res1.body.data[0].PhieuDatVe.MaPhieuDat).toBe(booking.MaPhieuDat);

      // Customer 2 should see 0 requests
      const res2 = await request(app)
        .get('/api/v1/hoan-tien/cua-toi')
        .set('Authorization', `Bearer ${customer2Token}`);

      expect(res2.status).toBe(200);
      expect(res2.body.data).toHaveLength(0);
    });

    it('12. Customer cannot request refund after showtime started', async () => {
      // Update showtime to start in the past
      const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 mins ago
      await prisma.suatChieu.update({
        where: { MaSuatChieu: showtime.MaSuatChieu },
        data: {
          NgayChieu: pastDate,
          GioChieu: pastDate,
        },
      });

      const res = await request(app)
        .post('/api/v1/hoan-tien/yeu-cau')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          MaPhieuDat: booking.MaPhieuDat,
          LyDo: 'Chiếu mất rồi vẫn muốn hoàn tiền',
          TenNganHang: 'MBBank',
          SoTaiKhoan: '999999',
          TenChuTaiKhoan: 'NGUYEN VAN A',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('đã bắt đầu hoặc đã diễn ra');
    });
  });
});
