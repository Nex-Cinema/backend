import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { Role } from '@prisma/client';
import {
  cleanupTestData,
  createTestAdmin,
  createTestCustomer,
  loginAndGetToken,
} from '../helpers';

describe('👤 Quản Lý Tài Khoản Nguời Dùng Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    await cleanupTestData();

    await createTestAdmin('admin_user_test', 'password123');
    await createTestCustomer('cust_user_test', 'password123');

    adminToken = await loginAndGetToken(app, 'admin_user_test', 'password123');
    customerToken = await loginAndGetToken(app, 'cust_user_test', 'password123');
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('🔑 Authorization', () => {
    it('should block non-admin from listing users', async () => {
      const res = await request(app)
        .get('/api/v1/admin/nguoi-dung')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('👤 User CRUD & Management Operations', () => {
    it('should create a customer without a staff profile', async () => {
      const payload = {
        TenDangNhap: 'customer_new_01',
        MatKhau: 'customerpassword',
        HoTen: 'Nguyễn Văn Customer',
        Email: 'customer01@cinema.com',
        SoDienThoai: '0987654321',
        GioiTinh: true,
        NgaySinh: '1995-10-15',
        VaiTro: Role.CUSTOMER,
      };

      const res = await request(app)
        .post('/api/v1/admin/nguoi-dung')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.TenDangNhap).toBe('customer_new_01');
      expect(res.body.data.KhachHang).toBeDefined();
      expect(res.body.data.NhanVien).toBeUndefined();
      expect(res.body.data.MatKhau).toBeUndefined(); // Security check
    });

    it('should reject the removed STAFF role', async () => {
      const res = await request(app)
        .post('/api/v1/admin/nguoi-dung')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          TenDangNhap: 'removed_staff',
          MatKhau: 'staffpassword',
          HoTen: 'Removed Staff',
          Email: 'removed-staff@cinema.com',
          SoDienThoai: '0987654322',
          VaiTro: 'STAFF',
          ChucVu: 'Nhân viên cũ',
        });

      expect(res.status).toBe(422);
    });

    it('should reject the removed ChucVu field', async () => {
      const res = await request(app)
        .post('/api/v1/admin/nguoi-dung')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          TenDangNhap: 'customer_with_title',
          MatKhau: 'customerpassword',
          HoTen: 'Customer With Title',
          Email: 'customer-title@cinema.com',
          SoDienThoai: '0987654323',
          VaiTro: 'CUSTOMER',
          ChucVu: 'Không còn hỗ trợ',
        });

      expect(res.status).toBe(422);
    });

    it('should reject creation with duplicate Email or username', async () => {
      const payload = {
        TenDangNhap: 'customer_new_01', // Duplicate username
        MatKhau: 'anotherpassword',
        HoTen: 'Duplicate Customer',
        Email: 'customer01@cinema.com', // Duplicate email
        SoDienThoai: '0987654324',
        VaiTro: Role.CUSTOMER,
      };

      const res = await request(app)
        .post('/api/v1/admin/nguoi-dung')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(409); // Conflict
    });

    it('should list users with pagination and filters', async () => {
      const res = await request(app)
        .get('/api/v1/admin/nguoi-dung')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 10,
          vaiTro: Role.CUSTOMER,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.pagination.page).toBe(1);
    });

    it('should update customer information', async () => {
      const user = await prisma.taiKhoan.findFirst({
        where: { TenDangNhap: 'customer_new_01' },
      });
      expect(user).not.toBeNull();

      const res = await request(app)
        .put(`/api/v1/admin/nguoi-dung/${user!.MaTaiKhoan}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          HoTen: 'Nguyễn Văn Customer Updated',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.HoTen).toBe('Nguyễn Văn Customer Updated');
      expect(res.body.data.NhanVien).toBeUndefined();
    });

    it('should reset user password and allow login with new password', async () => {
      const user = await prisma.taiKhoan.findFirst({
        where: { TenDangNhap: 'customer_new_01' },
      });
      expect(user).not.toBeNull();

      const resetRes = await request(app)
        .patch(`/api/v1/admin/nguoi-dung/${user!.MaTaiKhoan}/doi-mat-khau`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          MatKhau: 'newpassword123',
        });

      expect(resetRes.status).toBe(200);

      // Verify login works with new password
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          TenDangNhap: 'customer_new_01',
          MatKhau: 'newpassword123',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.tokens.accessToken).toBeDefined();
    });

    it('should hard delete user if they have no dependencies', async () => {
      // Create user without transactions
      const payload = {
        TenDangNhap: 'clean_user',
        MatKhau: 'cleanpassword',
        HoTen: 'Clean User',
        Email: 'clean@cinema.com',
        SoDienThoai: '0912345678',
        VaiTro: Role.CUSTOMER,
      };

      const createRes = await request(app)
        .post('/api/v1/admin/nguoi-dung')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      const maTaiKhoan = createRes.body.data.MaTaiKhoan;

      const deleteRes = await request(app)
        .delete(`/api/v1/admin/nguoi-dung/${maTaiKhoan}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toContain('vĩnh viễn thành công');

      const dbUser = await prisma.taiKhoan.findUnique({
        where: { MaTaiKhoan: maTaiKhoan },
      });
      expect(dbUser).toBeNull();
    });

    it('should soft delete user (KhaDung = false) if they have transactions/bookings', async () => {
      // Find our customer test user
      const customer = await prisma.taiKhoan.findFirst({
        where: { TenDangNhap: 'cust_user_test' },
        include: { KhachHang: true },
      });
      expect(customer).not.toBeNull();
      expect(customer!.KhachHang).not.toBeNull();

      // Create a dummy booking for this customer to simulate dependency
      const movie = await prisma.phim.create({
        data: {
          TenPhim: 'Test Movie',
          DaoDien: 'Director',
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
          TenPhong: 'Room For Soft Delete Customer',
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

      await prisma.phieuDatVe.create({
        data: {
          MaKhachHang: customer!.KhachHang!.MaKhachHang,
          TongTien: 50000,
          TrangThai: 'CHO_THANH_TOAN',
        },
      });

      const res = await request(app)
        .delete(`/api/v1/admin/nguoi-dung/${customer!.MaTaiKhoan}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('chỉ vô hiệu hóa tài khoản');

      const dbUser = await prisma.taiKhoan.findUnique({
        where: { MaTaiKhoan: customer!.MaTaiKhoan },
      });
      expect(dbUser?.KhaDung).toBe(false);
    });
  });
});
