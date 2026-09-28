import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import {
  cleanupTestData,
  createTestAdmin,
  createTestCustomer,
  loginAndGetToken,
} from '../helpers';

describe('👤 Customer Profile Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let customerAccount: any;
  let secondCustomerAccount: any;

  beforeAll(async () => {
    // Make sure we have a clean DB at the start
    await cleanupTestData();

    // Create test accounts
    await createTestAdmin('admin_profile_test', 'password123');
    customerAccount = await createTestCustomer('cust_profile_test', 'password123');
    // Create a second customer for duplicate email/phone tests (give it distinct random phone/email in helper)
    secondCustomerAccount = await prisma.taiKhoan.create({
      data: {
        TenDangNhap: 'cust_profile_test2',
        MatKhau: 'hashed_dummy',
        HoTen: 'Second Customer',
        Email: 'cust_profile_test2@test.com',
        SoDienThoai: '0999000444',
        VaiTro: 'CUSTOMER',
        KhachHang: { create: { KhaDung: true } },
      },
    });

    // Login and get tokens
    adminToken = await loginAndGetToken(app, 'admin_profile_test', 'password123');
    customerToken = await loginAndGetToken(app, 'cust_profile_test', 'password123');
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('GET /api/v1/tai-khoan/thong-tin', () => {
    it('1. CUSTOMER can view own profile', async () => {
      const res = await request(app)
        .get('/api/v1/tai-khoan/thong-tin')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.MaTaiKhoan).toBe(customerAccount.MaTaiKhoan);
      expect(res.body.data.TenDangNhap).toBe('cust_profile_test');
      expect(res.body.data.HoTen).toBe('Test Customer');
      expect(res.body.data.Email).toBe('cust_profile_test@test.com');
      expect(res.body.data.SoDienThoai).toBe(customerAccount.SoDienThoai);
      expect(res.body.data.VaiTro).toBe('CUSTOMER');
      expect(res.body.data.MaKhachHang).toBeDefined();
    });

    it('2. Profile response does not include MatKhau or RefreshTokens', async () => {
      const res = await request(app)
        .get('/api/v1/tai-khoan/thong-tin')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.MatKhau).toBeUndefined();
      expect(res.body.data.RefreshTokens).toBeUndefined();
      expect(res.body.data.refreshTokens).toBeUndefined();
    });

    it('3. ADMIN/Guest cannot access customer profile routes', async () => {
      // Guest
      const resGuest = await request(app).get('/api/v1/tai-khoan/thong-tin');
      expect(resGuest.status).toBe(401);

      // Admin
      const resAdmin = await request(app)
        .get('/api/v1/tai-khoan/thong-tin')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(403);
    });

    it('4. Cannot view profile if account is disabled (KhaDung = false)', async () => {
      // Temporarily disable the customer account
      await prisma.taiKhoan.update({
        where: { MaTaiKhoan: customerAccount.MaTaiKhoan },
        data: { KhaDung: false },
      });

      const res = await request(app)
        .get('/api/v1/tai-khoan/thong-tin')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('vô hiệu hóa');

      // Re-enable the customer account
      await prisma.taiKhoan.update({
        where: { MaTaiKhoan: customerAccount.MaTaiKhoan },
        data: { KhaDung: true },
      });
    });
  });

  describe('PUT /api/v1/tai-khoan/thong-tin', () => {
    it('1. CUSTOMER can update HoTen, Email, SoDienThoai, GioiTinh, NgaySinh', async () => {
      const updateData = {
        HoTen: 'Updated Name',
        Email: 'updated_email@test.com',
        SoDienThoai: '0988111222',
        GioiTinh: false,
        NgaySinh: '1995-12-25',
      };

      const res = await request(app)
        .put('/api/v1/tai-khoan/thong-tin')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.HoTen).toBe('Updated Name');
      expect(res.body.data.Email).toBe('updated_email@test.com');
      expect(res.body.data.SoDienThoai).toBe('0988111222');
      expect(res.body.data.GioiTinh).toBe(false);
      expect(new Date(res.body.data.NgaySinh).toISOString().split('T')[0]).toBe('1995-12-25');
      expect(res.body.data.MatKhau).toBeUndefined();
    });

    it('2. Cannot update Email to another user\'s email', async () => {
      const res = await request(app)
        .put('/api/v1/tai-khoan/thong-tin')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          Email: 'cust_profile_test2@test.com',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Email đã được sử dụng');
    });

    it('3. Cannot update SoDienThoai to another user\'s phone', async () => {
      const res = await request(app)
        .put('/api/v1/tai-khoan/thong-tin')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          SoDienThoai: '0999000444',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Số điện thoại đã được sử dụng');
    });

    it('4. Empty update body is rejected', async () => {
      const res = await request(app)
        .put('/api/v1/tai-khoan/thong-tin')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Dữ liệu đầu vào không hợp lệ');
    });

    it('5. Cannot update restricted fields via profile update', async () => {
      // Test restricted fields
      const restrictedFields = [
        { TenDangNhap: 'new_username' },
        { MatKhau: 'new_hashed_pass' },
        { VaiTro: 'ADMIN' },
        { KhaDung: false },
        { MaTaiKhoan: 'some-other-uuid' },
        { MaKhachHang: 'some-other-uuid' },
        { NgayTao: new Date() },
        { NgayCapNhat: new Date() },
      ];

      for (const field of restrictedFields) {
        const res = await request(app)
          .put('/api/v1/tai-khoan/thong-tin')
          .set('Authorization', `Bearer ${customerToken}`)
          .send(field);

        expect(res.status).toBe(422);
        expect(res.body.success).toBe(false);
        expect(res.body.errors.restricted_fields).toContain('Không được phép cập nhật các trường hạn chế');
      }
    });

    it('6. Cannot update profile if account is disabled (KhaDung = false)', async () => {
      // Disable customer
      await prisma.taiKhoan.update({
        where: { MaTaiKhoan: customerAccount.MaTaiKhoan },
        data: { KhaDung: false },
      });

      const res = await request(app)
        .put('/api/v1/tai-khoan/thong-tin')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ HoTen: 'Will Fail' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);

      // Re-enable
      await prisma.taiKhoan.update({
        where: { MaTaiKhoan: customerAccount.MaTaiKhoan },
        data: { KhaDung: true },
      });
    });
  });

  describe('PUT /api/v1/tai-khoan/doi-mat-khau', () => {
    it('1. Change password fails with wrong old password', async () => {
      const res = await request(app)
        .put('/api/v1/tai-khoan/doi-mat-khau')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MatKhauCu: 'wrongpassword',
          MatKhauMoi: 'newpassword123',
          XacNhanMatKhauMoi: 'newpassword123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Mật khẩu cũ không chính xác');
    });

    it('2. Change password fails if confirmation does not match', async () => {
      const res = await request(app)
        .put('/api/v1/tai-khoan/doi-mat-khau')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MatKhauCu: 'password123',
          MatKhauMoi: 'newpassword123',
          XacNhanMatKhauMoi: 'differentconfirm',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.XacNhanMatKhauMoi[0]).toContain('không khớp');
    });

    it('3. Change password fails if new password is same as old password', async () => {
      const res = await request(app)
        .put('/api/v1/tai-khoan/doi-mat-khau')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MatKhauCu: 'password123',
          MatKhauMoi: 'password123',
          XacNhanMatKhauMoi: 'password123',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.MatKhauMoi[0]).toContain('phải khác mật khẩu cũ');
    });


    it('4. Change password succeeds with correct old password and revokes refresh tokens', async () => {
      // Create a dummy active refresh token in the DB first
      const dummyToken = await prisma.refreshToken.create({
        data: {
          MaTaiKhoan: customerAccount.MaTaiKhoan,
          TokenHash: 'dummy_hash',
          HetHanLuc: new Date(Date.now() + 3600000), // 1 hour
          BiThuHoi: false,
        },
      });

      // Change password
      const res = await request(app)
        .put('/api/v1/tai-khoan/doi-mat-khau')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          MatKhauCu: 'password123',
          MatKhauMoi: 'newpassword123',
          XacNhanMatKhauMoi: 'newpassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Đổi mật khẩu thành công');

      // Verify in DB that the dummy refresh token has been revoked
      const updatedToken = await prisma.refreshToken.findUnique({
        where: { MaRefreshToken: dummyToken.MaRefreshToken },
      });
      expect(updatedToken?.BiThuHoi).toBe(true);

      // Restore password back to original so subsequent tests/runs don't break
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('password123', 4);
      await prisma.taiKhoan.update({
        where: { MaTaiKhoan: customerAccount.MaTaiKhoan },
        data: { MatKhau: hashedPassword },
      });
    });
  });
});
