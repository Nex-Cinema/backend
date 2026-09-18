import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { GioiHanTuoi } from '@prisma/client';
import {
  cleanupTestData,
  createTestAdmin,
  createTestCustomer,
  createTestStaff,
  loginAndGetToken,
  createTestMovie,
  createTicketDetailForMovie,
} from '../helpers';

describe('🎬 Phim Integration Tests', () => {
  let adminToken: string;
  let staffToken: string;
  let customerToken: string;

  beforeAll(async () => {
    // Make sure we have a clean DB at the start
    await cleanupTestData();

    // Create test accounts
    await createTestAdmin('admin_test', 'password123');
    await createTestStaff('staff_test', 'password123');
    await createTestCustomer('customer_test', 'password123');

    // Login and get tokens
    adminToken = await loginAndGetToken(app, 'admin_test', 'password123');
    staffToken = await loginAndGetToken(app, 'staff_test', 'password123');
    customerToken = await loginAndGetToken(app, 'customer_test', 'password123');
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Delete only movies, showtimes, seats, ticket details to preserve the logged in users
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
  });

  describe('🔍 Public Access', () => {
    it('should return only active movies by default', async () => {
      // Create 1 active and 1 inactive movie
      await createTestMovie({ TenPhim: 'Active Movie', KhaDung: true });
      await createTestMovie({ TenPhim: 'Inactive Movie', KhaDung: false });

      const res = await request(app).get('/api/v1/phim');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].TenPhim).toBe('Active Movie');
    });

    it('should return movie detail for an active movie', async () => {
      const movie = await createTestMovie({ TenPhim: 'Active Detail', KhaDung: true });

      const res = await request(app).get(`/api/v1/phim/${movie.MaPhim}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.TenPhim).toBe('Active Detail');
    });

    it('should not allow non-admin users to see details of inactive movies', async () => {
      const movie = await createTestMovie({ TenPhim: 'Inactive Detail', KhaDung: false });

      // Anonymous access
      const resAnon = await request(app).get(`/api/v1/phim/${movie.MaPhim}`);
      expect(resAnon.status).toBe(404);

      // Customer access
      const resCust = await request(app)
        .get(`/api/v1/phim/${movie.MaPhim}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(resCust.status).toBe(404);

      // Staff access
      const resStaff = await request(app)
        .get(`/api/v1/phim/${movie.MaPhim}`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(resStaff.status).toBe(404);
    });
  });

  describe('🔑 Admin Access', () => {
    it('should allow ADMIN to create a movie', async () => {
      const movieData = {
        TenPhim: 'New Movie Admin',
        ThoiLuong: 135,
        TheLoai: 'Sci-Fi',
        NgayKhoiChieu: '2026-06-01',
        NgayKetThuc: '2026-07-01',
        GioiHanTuoi: GioiHanTuoi.C16,
        Trailer: 'https://youtube.com/new_movie',
      };

      const res = await request(app)
        .post('/api/v1/admin/phim')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(movieData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.TenPhim).toBe('New Movie Admin');

      // Verify in DB
      const dbMovie = await prisma.phim.findFirst({
        where: { TenPhim: 'New Movie Admin' },
      });
      expect(dbMovie).toBeDefined();
      expect(dbMovie?.ThoiLuong).toBe(135);
    });

    it('should block non-admin users from creating a movie', async () => {
      const res = await request(app)
        .post('/api/v1/admin/phim')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          TenPhim: 'Attempt',
          ThoiLuong: 100,
          TheLoai: 'Comedy',
          NgayKhoiChieu: '2026-06-01',
          GioiHanTuoi: GioiHanTuoi.P,
          Trailer: 'https://youtube.com',
        });

      expect(res.status).toBe(403);
    });

    it('should allow ADMIN to update a movie', async () => {
      const movie = await createTestMovie({ TenPhim: 'To Update', ThoiLuong: 100 });

      const res = await request(app)
        .put(`/api/v1/admin/phim/${movie.MaPhim}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          TenPhim: 'Updated Title',
          ThoiLuong: 150,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.TenPhim).toBe('Updated Title');
      expect(res.body.data.ThoiLuong).toBe(150);
    });

    it('should allow ADMIN to soft delete a movie', async () => {
      const movie = await createTestMovie({ TenPhim: 'To Soft Delete', KhaDung: true });

      const res = await request(app)
        .patch(`/api/v1/admin/phim/${movie.MaPhim}/soft-delete`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify in DB
      const dbMovie = await prisma.phim.findUnique({
        where: { MaPhim: movie.MaPhim },
      });
      expect(dbMovie?.KhaDung).toBe(false);
    });

    it('should allow ADMIN to restore a soft-deleted movie', async () => {
      const movie = await createTestMovie({ TenPhim: 'To Restore', KhaDung: false });

      const res = await request(app)
        .patch(`/api/v1/admin/phim/${movie.MaPhim}/restore`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify in DB
      const dbMovie = await prisma.phim.findUnique({
        where: { MaPhim: movie.MaPhim },
      });
      expect(dbMovie?.KhaDung).toBe(true);
    });

    it('should allow ADMIN to hard delete a movie if no showtimes/ticket details exist', async () => {
      const movie = await createTestMovie({ TenPhim: 'To Hard Delete' });

      const res = await request(app)
        .delete(`/api/v1/admin/phim/${movie.MaPhim}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify in DB
      const dbMovie = await prisma.phim.findUnique({
        where: { MaPhim: movie.MaPhim },
      });
      expect(dbMovie).toBeNull();
    });

    it('should allow ADMIN to view inactive movies via includeInactive=true query', async () => {
      await createTestMovie({ TenPhim: 'Active Movie', KhaDung: true });
      await createTestMovie({ TenPhim: 'Inactive Movie', KhaDung: false });

      const res = await request(app)
        .get('/api/v1/phim?includeInactive=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('🛡️ Request Validation', () => {
    it('should fail to create movie without TenPhim', async () => {
      const res = await request(app)
        .post('/api/v1/admin/phim')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ThoiLuong: 120,
          TheLoai: 'Action',
          NgayKhoiChieu: '2026-06-01',
          GioiHanTuoi: GioiHanTuoi.P,
          Trailer: 'https://youtube.com',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.TenPhim).toContain('Tên phim là bắt buộc');
    });

    it('should fail to create movie with negative ThoiLuong', async () => {
      const res = await request(app)
        .post('/api/v1/admin/phim')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          TenPhim: 'Negative ThoiLuong',
          ThoiLuong: -50,
          TheLoai: 'Action',
          NgayKhoiChieu: '2026-06-01',
          GioiHanTuoi: GioiHanTuoi.P,
          Trailer: 'https://youtube.com',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.ThoiLuong).toContain('Thời lượng phim phải là số hợp lệ');
    });

    it('should fail to create movie with non-integer ThoiLuong', async () => {
      const res = await request(app)
        .post('/api/v1/admin/phim')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          TenPhim: 'Non-integer ThoiLuong',
          ThoiLuong: 120.5,
          TheLoai: 'Action',
          NgayKhoiChieu: '2026-06-01',
          GioiHanTuoi: GioiHanTuoi.P,
          Trailer: 'https://youtube.com',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.ThoiLuong).toContain('Thời lượng phim phải là số hợp lệ');
    });

    it('should fail to create movie with NgayKetThuc before NgayKhoiChieu', async () => {
      const res = await request(app)
        .post('/api/v1/admin/phim')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          TenPhim: 'Invalid End Date',
          ThoiLuong: 120,
          TheLoai: 'Action',
          NgayKhoiChieu: '2026-06-10',
          NgayKetThuc: '2026-06-05',
          GioiHanTuoi: GioiHanTuoi.P,
          Trailer: 'https://youtube.com',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.NgayKetThuc).toContain('Ngày kết thúc không hợp lệ');
    });

    it('should fail to create movie with invalid GioiHanTuoi', async () => {
      const res = await request(app)
        .post('/api/v1/admin/phim')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          TenPhim: 'Invalid Age Limit',
          ThoiLuong: 120,
          TheLoai: 'Action',
          NgayKhoiChieu: '2026-06-01',
          GioiHanTuoi: 'INVALID_ENUM_VALUE',
          Trailer: 'https://youtube.com',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.GioiHanTuoi).toBeDefined();
    });

    it('should fail to update movie with an empty body', async () => {
      const movie = await createTestMovie();

      const res = await request(app)
        .put(`/api/v1/admin/phim/${movie.MaPhim}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Dữ liệu đầu vào không hợp lệ');
    });
  });

  describe('💼 Business Rules', () => {
    it('should block creating movie with same TenPhim and NgayKhoiChieu', async () => {
      await createTestMovie({
        TenPhim: 'Duplicate Check',
        NgayKhoiChieu: new Date('2026-06-15'),
      });

      const res = await request(app)
        .post('/api/v1/admin/phim')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          TenPhim: 'Duplicate Check',
          ThoiLuong: 120,
          TheLoai: 'Action',
          NgayKhoiChieu: '2026-06-15',
          GioiHanTuoi: GioiHanTuoi.P,
          Trailer: 'https://youtube.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('đã tồn tại');
    });

    it('should block hard delete if related ticket details (ChiTietDatVe) exist', async () => {
      const movie = await createTestMovie({ TenPhim: 'Movie With Tickets' });
      await createTicketDetailForMovie(movie.MaPhim);

      const res = await request(app)
        .delete(`/api/v1/admin/phim/${movie.MaPhim}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Phim không thể xóa');
    });

    it('should block deletion of movie if any showtime exists', async () => {
      const movie = await createTestMovie({ TenPhim: 'Movie With Showtime' });
      
      const loaiNgay = await prisma.loaiNgay.create({
        data: { TenLoaiNgay: 'Weekday Test P', PhuThu: 0 },
      });
      const soDo = await prisma.soDoGhe.create({
        data: { TenSoDo: 'Test Sơ đồ P', SoHang: 5, SoCot: 5 },
      });
      const loaiPhong = await prisma.loaiPhong.create({
        data: { TenLoaiPhong: 'Test Phòng P', PhuThu: 0 },
      });
      const phongChieu = await prisma.phongChieu.create({
        data: { TenPhong: 'Phòng P', MaLoaiPhong: loaiPhong.MaLoaiPhong, MaSoDo: soDo.MaSoDo },
      });

      await prisma.suatChieu.create({
        data: {
          MaPhim: movie.MaPhim,
          MaPhong: phongChieu.MaPhong,
          MaLoaiNgay: loaiNgay.MaLoaiNgay,
          NgayChieu: new Date('2026-06-15'),
          GioChieu: new Date('2026-06-15T18:00:00Z'),
          GiaVeGoc: 50000,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/admin/phim/${movie.MaPhim}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Phim không thể xóa');
    });

    it('should block updating KhaDung of movie if any future showtime exists', async () => {
      const movie = await createTestMovie({ TenPhim: 'Movie Future Showtime', KhaDung: true });
      const futureDay = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      const loaiNgay = await prisma.loaiNgay.create({
        data: { TenLoaiNgay: 'Weekday Test F', PhuThu: 0 },
      });
      const soDo = await prisma.soDoGhe.create({
        data: { TenSoDo: 'Test Sơ đồ F', SoHang: 5, SoCot: 5 },
      });
      const loaiPhong = await prisma.loaiPhong.create({
        data: { TenLoaiPhong: 'Test Phòng F', PhuThu: 0 },
      });
      const phongChieu = await prisma.phongChieu.create({
        data: { TenPhong: 'Phòng F', MaLoaiPhong: loaiPhong.MaLoaiPhong, MaSoDo: soDo.MaSoDo },
      });

      await prisma.suatChieu.create({
        data: {
          MaPhim: movie.MaPhim,
          MaPhong: phongChieu.MaPhong,
          MaLoaiNgay: loaiNgay.MaLoaiNgay,
          NgayChieu: futureDay,
          GioChieu: new Date('2026-06-15T18:00:00Z'),
          GiaVeGoc: 50000,
        },
      });

      const res = await request(app)
        .put(`/api/v1/admin/phim/${movie.MaPhim}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ KhaDung: false });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Không thể cập nhật trạng thái khả dụng');
    });

    it('should allow updating KhaDung of movie if only past showtimes exist', async () => {
      const movie = await createTestMovie({ TenPhim: 'Movie Past Showtime', KhaDung: true });
      
      const loaiNgay = await prisma.loaiNgay.create({
        data: { TenLoaiNgay: 'Weekday Test Past', PhuThu: 0 },
      });
      const soDo = await prisma.soDoGhe.create({
        data: { TenSoDo: 'Test Sơ đồ Past', SoHang: 5, SoCot: 5 },
      });
      const loaiPhong = await prisma.loaiPhong.create({
        data: { TenLoaiPhong: 'Test Phòng Past', PhuThu: 0 },
      });
      const phongChieu = await prisma.phongChieu.create({
        data: { TenPhong: 'Phòng Past', MaLoaiPhong: loaiPhong.MaLoaiPhong, MaSoDo: soDo.MaSoDo },
      });

      await prisma.suatChieu.create({
        data: {
          MaPhim: movie.MaPhim,
          MaPhong: phongChieu.MaPhong,
          MaLoaiNgay: loaiNgay.MaLoaiNgay,
          NgayChieu: new Date('2020-01-01'),
          GioChieu: new Date('2020-01-01T12:00:00Z'),
          GiaVeGoc: 50000,
        },
      });

      const res = await request(app)
        .put(`/api/v1/admin/phim/${movie.MaPhim}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ KhaDung: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.KhaDung).toBe(false);
    });
  });
});
