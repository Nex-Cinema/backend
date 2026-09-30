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

describe('🏷️ Metadata Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    await cleanupTestData();

    // Create test accounts
    await createTestAdmin('admin_metadata', 'password123');
    await createTestCustomer('customer_metadata', 'password123');

    // Login and get tokens
    adminToken = await loginAndGetToken(app, 'admin_metadata', 'password123');
    customerToken = await loginAndGetToken(app, 'customer_metadata', 'password123');
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up relational records but preserve users
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

  // ==========================================
  // 1. LOẠI PHÒNG (Room Type) TESTS
  // ==========================================
  describe('🚪 Room Type (LoaiPhong) CRUD', () => {
    it('should block non-admin users from managing room types', async () => {
      // Create request from non-admin
      const res = await request(app)
        .post('/api/v1/admin/loai-phong')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ TenLoaiPhong: 'VIP', PhuThu: 20000 });
      expect(res.status).toBe(403);
    });

    it('should create, read, update, and hard delete a room type when unused', async () => {
      // 1. Create
      const resCreate = await request(app)
        .post('/api/v1/admin/loai-phong')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ TenLoaiPhong: 'Standard 2D', PhuThu: 10000 });

      expect(resCreate.status).toBe(201);
      expect(resCreate.body.success).toBe(true);
      expect(resCreate.body.data.TenLoaiPhong).toBe('Standard 2D');
      expect(Number(resCreate.body.data.PhuThu)).toBe(10000);
      const maLoaiPhong = resCreate.body.data.MaLoaiPhong;

      // 2. Read All
      const resGetAll = await request(app)
        .get('/api/v1/admin/loai-phong')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resGetAll.status).toBe(200);
      expect(resGetAll.body.data.some((lp: any) => lp.MaLoaiPhong === maLoaiPhong)).toBe(true);

      // 3. Read Detail
      const resGetOne = await request(app)
        .get(`/api/v1/admin/loai-phong/${maLoaiPhong}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resGetOne.status).toBe(200);
      expect(resGetOne.body.data.TenLoaiPhong).toBe('Standard 2D');

      // 4. Update
      const resUpdate = await request(app)
        .put(`/api/v1/admin/loai-phong/${maLoaiPhong}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ TenLoaiPhong: 'IMAX 3D', PhuThu: 50000 });
      expect(resUpdate.status).toBe(200);
      expect(resUpdate.body.data.TenLoaiPhong).toBe('IMAX 3D');
      expect(Number(resUpdate.body.data.PhuThu)).toBe(50000);

      // 5. Hard Delete
      const resDelete = await request(app)
        .delete(`/api/v1/admin/loai-phong/${maLoaiPhong}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resDelete.status).toBe(200);
      expect(resDelete.body.message).toContain('Xóa loại phòng vĩnh viễn thành công');

      // Verify not in DB
      const dbRecord = await prisma.loaiPhong.findUnique({ where: { MaLoaiPhong: maLoaiPhong } });
      expect(dbRecord).toBeNull();
    });

    it('should soft delete room type (set KhaDung = false) when used by a screening room', async () => {
      // 1. Create room type
      const loaiPhong = await prisma.loaiPhong.create({
        data: { TenLoaiPhong: 'Used Room Type', PhuThu: 15000 },
      });

      // 2. Associate with screening room
      const soDo = await prisma.soDoGhe.create({
        data: { TenSoDo: 'Test Sơ đồ', SoHang: 5, SoCot: 5 },
      });
      await prisma.phongChieu.create({
        data: {
          TenPhong: 'Phòng Test 1',
          MaLoaiPhong: loaiPhong.MaLoaiPhong,
          MaSoDo: soDo.MaSoDo,
        },
      });

      // 3. Delete request
      const res = await request(app)
        .delete(`/api/v1/admin/loai-phong/${loaiPhong.MaLoaiPhong}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('đã ẩn trạng thái khả dụng');
      expect(res.body.data.KhaDung).toBe(false);

      // Verify in DB
      const dbRecord = await prisma.loaiPhong.findUnique({ where: { MaLoaiPhong: loaiPhong.MaLoaiPhong } });
      expect(dbRecord).toBeDefined();
      expect(dbRecord?.KhaDung).toBe(false);
    });
  });

  // ==========================================
  // 2. LOẠI GHẾ (Seat Type) TESTS
  // ==========================================
  describe('💺 Seat Type (LoaiGhe) CRUD', () => {
    it('should create, read, update, and hard delete a seat type when unused', async () => {
      // 1. Create
      const resCreate = await request(app)
        .post('/api/v1/admin/loai-ghe')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ TenLoaiGhe: 'Sweetbox', PhuThu: 25000 });

      expect(resCreate.status).toBe(201);
      expect(resCreate.body.data.TenLoaiGhe).toBe('Sweetbox');
      const maLoaiGhe = resCreate.body.data.MaLoaiGhe;

      // 2. Read All
      const resGetAll = await request(app)
        .get('/api/v1/admin/loai-ghe')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resGetAll.status).toBe(200);
      expect(resGetAll.body.data.some((lg: any) => lg.MaLoaiGhe === maLoaiGhe)).toBe(true);

      // 3. Read Detail
      const resGetOne = await request(app)
        .get(`/api/v1/admin/loai-ghe/${maLoaiGhe}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resGetOne.status).toBe(200);
      expect(resGetOne.body.data.TenLoaiGhe).toBe('Sweetbox');

      // 4. Update
      const resUpdate = await request(app)
        .put(`/api/v1/admin/loai-ghe/${maLoaiGhe}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ TenLoaiGhe: 'Double Seat', PhuThu: 30000 });
      expect(resUpdate.status).toBe(200);
      expect(resUpdate.body.data.TenLoaiGhe).toBe('Double Seat');
      expect(Number(resUpdate.body.data.PhuThu)).toBe(30000);

      // 5. Hard Delete
      const resDelete = await request(app)
        .delete(`/api/v1/admin/loai-ghe/${maLoaiGhe}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resDelete.status).toBe(200);
      expect(resDelete.body.message).toContain('Xóa loại ghế vĩnh viễn thành công');

      const dbRecord = await prisma.loaiGhe.findUnique({ where: { MaLoaiGhe: maLoaiGhe } });
      expect(dbRecord).toBeNull();
    });

    it('should soft delete seat type (set KhaDung = false) when used by a seat', async () => {
      const loaiGhe = await prisma.loaiGhe.create({
        data: { TenLoaiGhe: 'Used Seat Type', PhuThu: 5000 },
      });

      const soDo = await prisma.soDoGhe.create({
        data: { TenSoDo: 'Test Sơ đồ', SoHang: 5, SoCot: 5 },
      });
      const loaiPhong = await prisma.loaiPhong.create({
        data: { TenLoaiPhong: 'Test Room Type', PhuThu: 0.0 },
      });
      const phong = await prisma.phongChieu.create({
        data: { TenPhong: 'Phòng test Ghế', MaLoaiPhong: loaiPhong.MaLoaiPhong, MaSoDo: soDo.MaSoDo },
      });
      await prisma.ghe.create({
        data: {
          ViTriDay: 'A',
          ViTriCot: 1,
          MaPhong: phong.MaPhong,
          MaLoaiGhe: loaiGhe.MaLoaiGhe,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/admin/loai-ghe/${loaiGhe.MaLoaiGhe}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('đã ẩn trạng thái khả dụng');
      expect(res.body.data.KhaDung).toBe(false);

      const dbRecord = await prisma.loaiGhe.findUnique({ where: { MaLoaiGhe: loaiGhe.MaLoaiGhe } });
      expect(dbRecord?.KhaDung).toBe(false);
    });
  });

  // ==========================================
  // 3. LOẠI NGÀY (Day Type) TESTS
  // ==========================================
  describe('📅 Day Type (LoaiNgay) CRUD', () => {
    it('should create, read, update, and hard delete a day type when unused', async () => {
      // 1. Create
      const resCreate = await request(app)
        .post('/api/v1/admin/loai-ngay')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ TenLoaiNgay: 'Holiday', PhuThu: 15000 });

      expect(resCreate.status).toBe(201);
      expect(resCreate.body.data.TenLoaiNgay).toBe('Holiday');
      const maLoaiNgay = resCreate.body.data.MaLoaiNgay;

      // 2. Read All
      const resGetAll = await request(app)
        .get('/api/v1/admin/loai-ngay')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resGetAll.status).toBe(200);
      expect(resGetAll.body.data.some((ln: any) => ln.MaLoaiNgay === maLoaiNgay)).toBe(true);

      // 3. Read Detail
      const resGetOne = await request(app)
        .get(`/api/v1/admin/loai-ngay/${maLoaiNgay}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resGetOne.status).toBe(200);
      expect(resGetOne.body.data.TenLoaiNgay).toBe('Holiday');

      // 4. Update
      const resUpdate = await request(app)
        .put(`/api/v1/admin/loai-ngay/${maLoaiNgay}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ TenLoaiNgay: 'Tet Holiday', PhuThu: 25000 });
      expect(resUpdate.status).toBe(200);
      expect(resUpdate.body.data.TenLoaiNgay).toBe('Tet Holiday');
      expect(Number(resUpdate.body.data.PhuThu)).toBe(25000);

      // 5. Hard Delete
      const resDelete = await request(app)
        .delete(`/api/v1/admin/loai-ngay/${maLoaiNgay}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resDelete.status).toBe(200);
      expect(resDelete.body.message).toContain('Xóa loại ngày vĩnh viễn thành công');

      const dbRecord = await prisma.loaiNgay.findUnique({ where: { MaLoaiNgay: maLoaiNgay } });
      expect(dbRecord).toBeNull();
    });

    it('should soft delete day type (set KhaDung = false) when used by a showtime', async () => {
      const loaiNgay = await prisma.loaiNgay.create({
        data: { TenLoaiNgay: 'Used Day Type', PhuThu: 8000 },
      });

      const movie = await createTestMovie();
      const soDo = await prisma.soDoGhe.create({
        data: { TenSoDo: 'Test Sơ đồ', SoHang: 5, SoCot: 5 },
      });
      const loaiPhong = await prisma.loaiPhong.create({
        data: { TenLoaiPhong: 'Test Room Type', PhuThu: 0.0 },
      });
      const phong = await prisma.phongChieu.create({
        data: { TenPhong: 'Phòng test Ngày', MaLoaiPhong: loaiPhong.MaLoaiPhong, MaSoDo: soDo.MaSoDo },
      });

      await prisma.suatChieu.create({
        data: {
          MaPhim: movie.MaPhim,
          MaPhong: phong.MaPhong,
          MaLoaiNgay: loaiNgay.MaLoaiNgay,
          NgayChieu: new Date('2026-06-15'),
          GioChieu: new Date('2026-06-15T18:00:00Z'),
          GiaVeGoc: 50000.0,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/admin/loai-ngay/${loaiNgay.MaLoaiNgay}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('đã ẩn trạng thái khả dụng');
      expect(res.body.data.KhaDung).toBe(false);

      const dbRecord = await prisma.loaiNgay.findUnique({ where: { MaLoaiNgay: loaiNgay.MaLoaiNgay } });
      expect(dbRecord?.KhaDung).toBe(false);
    });
  });
});
