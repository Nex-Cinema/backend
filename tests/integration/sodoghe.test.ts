import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import {
  cleanupTestData,
  createTestAdmin,
  createTestCustomer,
  loginAndGetToken,
} from '../helpers';

describe('🪑 Sơ Đồ Ghế Mẫu Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    await cleanupTestData();

    await createTestAdmin('admin_sodoghe', 'password123');
    await createTestCustomer('customer_sodoghe', 'password123');

    adminToken = await loginAndGetToken(app, 'admin_sodoghe', 'password123');
    customerToken = await loginAndGetToken(app, 'customer_sodoghe', 'password123');
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clear dependencies and templates
    await prisma.phongChieu.deleteMany({});
    await prisma.soDoGhe.deleteMany({});
  });

  describe('🔑 Authorization', () => {
    it('should block non-admin from creating a seat map template', async () => {
      const res = await request(app)
        .post('/api/v1/admin/so-do-ghe')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          TenSoDo: 'Blocked Map',
          SoHang: 5,
          SoCot: 5,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('📦 SoDoGhe CRUD Operations', () => {
    it('should create and read a seat map template successfully', async () => {
      const createRes = await request(app)
        .post('/api/v1/admin/so-do-ghe')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          TenSoDo: 'Standard 8x8',
          SoHang: 8,
          SoCot: 8,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.TenSoDo).toBe('Standard 8x8');
      expect(createRes.body.data.SoHang).toBe(8);

      const maSoDo = createRes.body.data.MaSoDo;

      // Get list
      const listRes = await request(app)
        .get('/api/v1/admin/so-do-ghe')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].MaSoDo).toBe(maSoDo);

      // Get details
      const detailRes = await request(app)
        .get(`/api/v1/admin/so-do-ghe/${maSoDo}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.TenSoDo).toBe('Standard 8x8');
    });

    it('should fail to create template with invalid dimensions', async () => {
      const res = await request(app)
        .post('/api/v1/admin/so-do-ghe')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          TenSoDo: 'Invalid Map',
          SoHang: 0, // Invalid (min 1)
          SoCot: 25, // Invalid (max 20)
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should update name/size of unused template successfully', async () => {
      const template = await prisma.soDoGhe.create({
        data: { TenSoDo: 'Old Template', SoHang: 5, SoCot: 5 },
      });

      const res = await request(app)
        .put(`/api/v1/admin/so-do-ghe/${template.MaSoDo}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          TenSoDo: 'Updated Template',
          SoHang: 6,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.TenSoDo).toBe('Updated Template');
      expect(res.body.data.SoHang).toBe(6);
    });

    it('should block size updates of template if used by a room', async () => {
      const template = await prisma.soDoGhe.create({
        data: { TenSoDo: 'Used Template', SoHang: 5, SoCot: 5 },
      });

      const loaiPhong = await prisma.loaiPhong.create({
        data: { TenLoaiPhong: 'Standard 2D', PhuThu: 0 },
      });

      // Create a room that uses this template
      await prisma.phongChieu.create({
        data: {
          TenPhong: 'Room X',
          MaLoaiPhong: loaiPhong.MaLoaiPhong,
          MaSoDo: template.MaSoDo,
        },
      });

      const res = await request(app)
        .put(`/api/v1/admin/so-do-ghe/${template.MaSoDo}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          SoHang: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('đang được phòng chiếu sử dụng');
    });

    it('should hard delete template if unused', async () => {
      const template = await prisma.soDoGhe.create({
        data: { TenSoDo: 'Unused Template', SoHang: 5, SoCot: 5 },
      });

      const res = await request(app)
        .delete(`/api/v1/admin/so-do-ghe/${template.MaSoDo}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('vĩnh viễn');

      const dbTemplate = await prisma.soDoGhe.findUnique({
        where: { MaSoDo: template.MaSoDo },
      });
      expect(dbTemplate).toBeNull();
    });

    it('should soft delete template (KhaDung = false) if used by a room', async () => {
      const template = await prisma.soDoGhe.create({
        data: { TenSoDo: 'Used For Soft Delete', SoHang: 5, SoCot: 5 },
      });

      const loaiPhong = await prisma.loaiPhong.create({
        data: { TenLoaiPhong: 'Standard 2D', PhuThu: 0 },
      });

      await prisma.phongChieu.create({
        data: {
          TenPhong: 'Room Y',
          MaLoaiPhong: loaiPhong.MaLoaiPhong,
          MaSoDo: template.MaSoDo,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/admin/so-do-ghe/${template.MaSoDo}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('đã ẩn trạng thái khả dụng');

      const dbTemplate = await prisma.soDoGhe.findUnique({
        where: { MaSoDo: template.MaSoDo },
      });
      expect(dbTemplate?.KhaDung).toBe(false);
    });
  });
});
