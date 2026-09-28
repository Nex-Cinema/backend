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

describe('🚪 Phòng Chiếu & Cấu hình Ghế Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let defaultSoDoId: string;
  let defaultLoaiPhongId: string;
  let defaultLoaiGheId: string;

  beforeAll(async () => {
    await cleanupTestData();

    // Create test accounts
    await createTestAdmin('admin_phongchieu', 'password123');
    await createTestCustomer('customer_phongchieu', 'password123');

    // Login and get tokens
    adminToken = await loginAndGetToken(app, 'admin_phongchieu', 'password123');
    customerToken = await loginAndGetToken(app, 'customer_phongchieu', 'password123');
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Delete transactional items but keep users
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

    // Seed required metadata
    const soDo = await prisma.soDoGhe.create({
      data: { TenSoDo: 'Standard 5x5', SoHang: 5, SoCot: 5 },
    });
    defaultSoDoId = soDo.MaSoDo;

    const loaiPhong = await prisma.loaiPhong.create({
      data: { TenLoaiPhong: 'Standard 2D', PhuThu: 0 },
    });
    defaultLoaiPhongId = loaiPhong.MaLoaiPhong;

    const loaiGhe = await prisma.loaiGhe.create({
      data: { TenLoaiGhe: 'Thường', PhuThu: 0 },
    });
    defaultLoaiGheId = loaiGhe.MaLoaiGhe;
  });

  describe('🔑 Authorization', () => {
    it('should block non-admin from creating a room', async () => {
      const res = await request(app)
        .post('/api/v1/admin/phong-chieu')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          TenPhong: 'Phòng 99',
          MaLoaiPhong: defaultLoaiPhongId,
          MaSoDo: defaultSoDoId,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('📦 CRUD Screening Room', () => {
    it('should create a room and automatically generate 25 seats for a 5x5 layout', async () => {
      const res = await request(app)
        .post('/api/v1/admin/phong-chieu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          TenPhong: 'Phòng 01',
          MaLoaiPhong: defaultLoaiPhongId,
          MaSoDo: defaultSoDoId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.TenPhong).toBe('Phòng 01');
      const maPhong = res.body.data.MaPhong;

      // Verify seats are generated in DB
      const seatCount = await prisma.ghe.count({
        where: { MaPhong: maPhong },
      });
      expect(seatCount).toBe(25); // 5 rows * 5 columns

      const firstSeat = await prisma.ghe.findFirst({
        where: { MaPhong: maPhong, ViTriDay: 'A', ViTriCot: 1 },
      });
      expect(firstSeat).toBeDefined();
      expect(firstSeat?.MaLoaiGhe).toBe(defaultLoaiGheId);
    });

    it('should return error when creating a room with duplicate name', async () => {
      // Create first room
      await request(app)
        .post('/api/v1/admin/phong-chieu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          TenPhong: 'Phòng Trùng',
          MaLoaiPhong: defaultLoaiPhongId,
          MaSoDo: defaultSoDoId,
        });

      // Try creating second room with same name
      const res = await request(app)
        .post('/api/v1/admin/phong-chieu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          TenPhong: 'Phòng Trùng',
          MaLoaiPhong: defaultLoaiPhongId,
          MaSoDo: defaultSoDoId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('đã tồn tại');
    });

    it('should read all rooms and read single room details', async () => {
      const room = await prisma.phongChieu.create({
        data: { TenPhong: 'Phòng 02', MaLoaiPhong: defaultLoaiPhongId, MaSoDo: defaultSoDoId },
      });

      // Get list
      const resList = await request(app)
        .get('/api/v1/admin/phong-chieu')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resList.status).toBe(200);
      expect(resList.body.data.some((r: any) => r.MaPhong === room.MaPhong)).toBe(true);

      // Get detail
      const resDetail = await request(app)
        .get(`/api/v1/admin/phong-chieu/${room.MaPhong}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resDetail.status).toBe(200);
      expect(resDetail.body.data.TenPhong).toBe('Phòng 02');
    });

    it('should update room details without regenerating seats if MaSoDo does not change', async () => {
      const room = await prisma.phongChieu.create({
        data: { TenPhong: 'Phòng 03', MaLoaiPhong: defaultLoaiPhongId, MaSoDo: defaultSoDoId },
      });
      // Generate some seats manually
      await prisma.ghe.create({
        data: { ViTriDay: 'A', ViTriCot: 1, MaPhong: room.MaPhong, MaLoaiGhe: defaultLoaiGheId },
      });

      const res = await request(app)
        .put(`/api/v1/admin/phong-chieu/${room.MaPhong}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ TenPhong: 'Phòng 03 Đổi Tên' });

      expect(res.status).toBe(200);
      expect(res.body.data.TenPhong).toBe('Phòng 03 Đổi Tên');

      const seats = await prisma.ghe.findMany({ where: { MaPhong: room.MaPhong } });
      expect(seats).toHaveLength(1);
      expect(seats[0].ViTriDay).toBe('A');
    });

    it('should regenerate seats when updating MaSoDo', async () => {
      const room = await prisma.phongChieu.create({
        data: { TenPhong: 'Phòng 04', MaLoaiPhong: defaultLoaiPhongId, MaSoDo: defaultSoDoId },
      });
      // Manually add one old seat
      await prisma.ghe.create({
        data: { ViTriDay: 'A', ViTriCot: 1, MaPhong: room.MaPhong, MaLoaiGhe: defaultLoaiGheId },
      });

      // Create new 3x4 layout template
      const newSoDo = await prisma.soDoGhe.create({
        data: { TenSoDo: 'New 3x4', SoHang: 3, SoCot: 4 },
      });

      const res = await request(app)
        .put(`/api/v1/admin/phong-chieu/${room.MaPhong}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ MaSoDo: newSoDo.MaSoDo });

      expect(res.status).toBe(200);
      expect(res.body.data.MaSoDo).toBe(newSoDo.MaSoDo);

      // Verify seats are regenerated to 12 seats (3 * 4)
      const seats = await prisma.ghe.findMany({ where: { MaPhong: room.MaPhong } });
      expect(seats).toHaveLength(12);
    });

    it('should fail to update MaSoDo if the room already has showtimes scheduled', async () => {
      const room = await prisma.phongChieu.create({
        data: { TenPhong: 'Phòng 05', MaLoaiPhong: defaultLoaiPhongId, MaSoDo: defaultSoDoId },
      });

      const movie = await createTestMovie();
      const loaiNgay = await prisma.loaiNgay.create({
        data: { TenLoaiNgay: 'Weekday', PhuThu: 0 },
      });

      // Add showtime
      await prisma.suatChieu.create({
        data: {
          MaPhim: movie.MaPhim,
          MaPhong: room.MaPhong,
          MaLoaiNgay: loaiNgay.MaLoaiNgay,
          NgayChieu: new Date('2026-06-10'),
          GioChieu: new Date('2026-06-10T14:00:00Z'),
          GiaVeGoc: 50000,
        },
      });

      const newSoDo = await prisma.soDoGhe.create({
        data: { TenSoDo: 'New 3x3', SoHang: 3, SoCot: 3 },
      });

      const res = await request(app)
        .put(`/api/v1/admin/phong-chieu/${room.MaPhong}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ MaSoDo: newSoDo.MaSoDo });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Không thể thay đổi sơ đồ ghế');
    });

    it('should fail to update room details (MaLoaiPhong or MaSoDo) if a showtime has sold or held tickets', async () => {
      const room = await prisma.phongChieu.create({
        data: { TenPhong: 'Phòng Bán Vé Update', MaLoaiPhong: defaultLoaiPhongId, MaSoDo: defaultSoDoId },
      });

      const movie = await createTestMovie();
      const loaiNgay = await prisma.loaiNgay.create({
        data: { TenLoaiNgay: 'Weekday Test', PhuThu: 0 },
      });

      const ghe = await prisma.ghe.create({
        data: { ViTriDay: 'A', ViTriCot: 1, MaPhong: room.MaPhong, MaLoaiGhe: defaultLoaiGheId },
      });

      const suatChieu = await prisma.suatChieu.create({
        data: {
          MaPhim: movie.MaPhim,
          MaPhong: room.MaPhong,
          MaLoaiNgay: loaiNgay.MaLoaiNgay,
          NgayChieu: new Date('2026-06-10'),
          GioChieu: new Date('2026-06-10T14:00:00Z'),
          GiaVeGoc: 50000,
        },
      });

      // Held seat (status: DANG_GIU)
      await prisma.gheSuatChieu.create({
        data: {
          MaSuatChieu: suatChieu.MaSuatChieu,
          MaGhe: ghe.MaGhe,
          TrangThai: TrangThaiGheSuatChieu.DANG_GIU,
          GiaVe: 50000,
        },
      });

      const newLoaiPhong = await prisma.loaiPhong.create({
        data: { TenLoaiPhong: 'IMAX Test', PhuThu: 50000 },
      });

      const res = await request(app)
        .put(`/api/v1/admin/phong-chieu/${room.MaPhong}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ MaLoaiPhong: newLoaiPhong.MaLoaiPhong });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Không thể cập nhật thông tin phòng chiếu');
    });

    it('should successfully cascade delete room (delete seats and showtimes) if no tickets are sold', async () => {
      const room = await prisma.phongChieu.create({
        data: { TenPhong: 'Phòng Xóa', MaLoaiPhong: defaultLoaiPhongId, MaSoDo: defaultSoDoId },
      });

      const movie = await createTestMovie();
      const loaiNgay = await prisma.loaiNgay.create({
        data: { TenLoaiNgay: 'Weekday', PhuThu: 0 },
      });

      const ghe = await prisma.ghe.create({
        data: { ViTriDay: 'A', ViTriCot: 1, MaPhong: room.MaPhong, MaLoaiGhe: defaultLoaiGheId },
      });

      const suatChieu = await prisma.suatChieu.create({
        data: {
          MaPhim: movie.MaPhim,
          MaPhong: room.MaPhong,
          MaLoaiNgay: loaiNgay.MaLoaiNgay,
          NgayChieu: new Date('2026-06-10'),
          GioChieu: new Date('2026-06-10T14:00:00Z'),
          GiaVeGoc: 50000,
        },
      });

      await prisma.gheSuatChieu.create({
        data: {
          MaSuatChieu: suatChieu.MaSuatChieu,
          MaGhe: ghe.MaGhe,
          TrangThai: TrangThaiGheSuatChieu.TRONG,
          GiaVe: 50000,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/admin/phong-chieu/${room.MaPhong}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify everything is deleted
      const dbRoom = await prisma.phongChieu.findUnique({ where: { MaPhong: room.MaPhong } });
      const dbSeats = await prisma.ghe.findMany({ where: { MaPhong: room.MaPhong } });
      const dbShowtimes = await prisma.suatChieu.findMany({ where: { MaPhong: room.MaPhong } });

      expect(dbRoom).toBeNull();
      expect(dbSeats).toHaveLength(0);
      expect(dbShowtimes).toHaveLength(0);
    });

    it('should block room delete if tickets have been sold', async () => {
      const room = await prisma.phongChieu.create({
        data: { TenPhong: 'Phòng Có Vé', MaLoaiPhong: defaultLoaiPhongId, MaSoDo: defaultSoDoId },
      });

      const movie = await createTestMovie();
      const loaiNgay = await prisma.loaiNgay.create({
        data: { TenLoaiNgay: 'Weekday', PhuThu: 0 },
      });

      const ghe = await prisma.ghe.create({
        data: { ViTriDay: 'A', ViTriCot: 1, MaPhong: room.MaPhong, MaLoaiGhe: defaultLoaiGheId },
      });

      const suatChieu = await prisma.suatChieu.create({
        data: {
          MaPhim: movie.MaPhim,
          MaPhong: room.MaPhong,
          MaLoaiNgay: loaiNgay.MaLoaiNgay,
          NgayChieu: new Date('2026-06-10'),
          GioChieu: new Date('2026-06-10T14:00:00Z'),
          GiaVeGoc: 50000,
        },
      });

      const gheSuatChieu = await prisma.gheSuatChieu.create({
        data: {
          MaSuatChieu: suatChieu.MaSuatChieu,
          MaGhe: ghe.MaGhe,
          TrangThai: TrangThaiGheSuatChieu.DA_DAT,
          GiaVe: 50000,
        },
      });

      const customer = await prisma.khachHang.findFirstOrThrow();
      const phieuDatVe = await prisma.phieuDatVe.create({
        data: {
          MaKhachHang: customer.MaKhachHang,
          TongTien: 50000,
          TrangThai: TrangThaiPhieuDatVe.DA_THANH_TOAN,
        },
      });

      await prisma.chiTietDatVe.create({
        data: {
          MaPhieuDat: phieuDatVe.MaPhieuDat,
          MaGheSuatChieu: gheSuatChieu.MaGheSuatChieu,
          GiaVe: 50000,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/admin/phong-chieu/${room.MaPhong}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Không thể xóa phòng chiếu này');
    });
  });

  describe('🪑 Seat Configuration', () => {
    it('should read seats in a room and bulk update seat configurations', async () => {
      const room = await prisma.phongChieu.create({
        data: { TenPhong: 'Phòng Ghế', MaLoaiPhong: defaultLoaiPhongId, MaSoDo: defaultSoDoId },
      });

      const seat1 = await prisma.ghe.create({
        data: { ViTriDay: 'A', ViTriCot: 1, MaPhong: room.MaPhong, MaLoaiGhe: defaultLoaiGheId, KhaDung: true },
      });
      const seat2 = await prisma.ghe.create({
        data: { ViTriDay: 'A', ViTriCot: 2, MaPhong: room.MaPhong, MaLoaiGhe: defaultLoaiGheId, KhaDung: true },
      });

      // Get seats list
      const resList = await request(app)
        .get(`/api/v1/admin/phong-chieu/${room.MaPhong}/ghe`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resList.status).toBe(200);
      expect(resList.body.data).toHaveLength(2);

      // Create new VIP seat type
      const vipLoaiGhe = await prisma.loaiGhe.create({
        data: { TenLoaiGhe: 'VIP', PhuThu: 20000 },
      });

      // Bulk update seat config
      const updateData = {
        ghes: [
          { maGhe: seat1.MaGhe, maLoaiGhe: vipLoaiGhe.MaLoaiGhe, khaDung: true },
          { maGhe: seat2.MaGhe, maLoaiGhe: defaultLoaiGheId, khaDung: false },
        ],
      };

      const resUpdate = await request(app)
        .put(`/api/v1/admin/phong-chieu/${room.MaPhong}/ghe`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(resUpdate.status).toBe(200);
      expect(resUpdate.body.success).toBe(true);

      // Verify in DB
      const dbSeat1 = await prisma.ghe.findUnique({ where: { MaGhe: seat1.MaGhe } });
      const dbSeat2 = await prisma.ghe.findUnique({ where: { MaGhe: seat2.MaGhe } });

      expect(dbSeat1?.MaLoaiGhe).toBe(vipLoaiGhe.MaLoaiGhe);
      expect(dbSeat1?.KhaDung).toBe(true);

      expect(dbSeat2?.MaLoaiGhe).toBe(defaultLoaiGheId);
      expect(dbSeat2?.KhaDung).toBe(false);
    });

    it('should fail to bulk update seat configurations if a showtime has sold or held tickets', async () => {
      const room = await prisma.phongChieu.create({
        data: { TenPhong: 'Phòng Ghế Bán Vé', MaLoaiPhong: defaultLoaiPhongId, MaSoDo: defaultSoDoId },
      });

      const seat1 = await prisma.ghe.create({
        data: { ViTriDay: 'A', ViTriCot: 1, MaPhong: room.MaPhong, MaLoaiGhe: defaultLoaiGheId, KhaDung: true },
      });

      const movie = await createTestMovie();
      const loaiNgay = await prisma.loaiNgay.create({
        data: { TenLoaiNgay: 'Weekday Test 2', PhuThu: 0 },
      });

      const suatChieu = await prisma.suatChieu.create({
        data: {
          MaPhim: movie.MaPhim,
          MaPhong: room.MaPhong,
          MaLoaiNgay: loaiNgay.MaLoaiNgay,
          NgayChieu: new Date('2026-06-10'),
          GioChieu: new Date('2026-06-10T14:00:00Z'),
          GiaVeGoc: 50000,
        },
      });

      // Sold seat (status: DA_DAT)
      await prisma.gheSuatChieu.create({
        data: {
          MaSuatChieu: suatChieu.MaSuatChieu,
          MaGhe: seat1.MaGhe,
          TrangThai: TrangThaiGheSuatChieu.DA_DAT,
          GiaVe: 50000,
        },
      });

      const updateData = {
        ghes: [
          { maGhe: seat1.MaGhe, maLoaiGhe: defaultLoaiGheId, khaDung: false },
        ],
      };

      const res = await request(app)
        .put(`/api/v1/admin/phong-chieu/${room.MaPhong}/ghe`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Không thể cập nhật cấu hình ghế');
    });
  });
});
