import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { cleanupTestData, createTestCustomer } from '../helpers';
import * as emailUtil from '../../src/utils/email.util';

// Capture the generated plain OTP
let latestCapturedOtp = '';


describe('🔑 Forgot Password & Reset Password Integration Tests', () => {
  let customerAccount: any;
  const customerEmail = 'cust_forgot_test@test.com';
  const customerUsername = 'cust_forgot_test';
  const originalPassword = 'password123';

  beforeAll(async () => {
    await cleanupTestData();

    // Create the test customer account
    customerAccount = await prisma.taiKhoan.create({
      data: {
        TenDangNhap: customerUsername,
        MatKhau: await require('bcrypt').hash(originalPassword, 4),
        HoTen: 'Test Forgot Password User',
        Email: customerEmail,
        SoDienThoai: '0987111222',
        VaiTro: 'CUSTOMER',
        KhaDung: true,
        KhachHang: { create: { KhaDung: true } },
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    latestCapturedOtp = '';
    jest.spyOn(emailUtil, 'sendResetOtpEmail').mockImplementation(async (email: string, otp: string) => {
      latestCapturedOtp = otp;
      return true;
    });
  });

  describe('1. POST /api/v1/auth/forgot-password', () => {
    it('should return a generic success message even if the email does not exist, and not generate OTP', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ Email: 'non_existent_email@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Nếu email tồn tại trong hệ thống, mã xác nhận đã được gửi.');
      expect(latestCapturedOtp).toBe('');
    });

    it('should return validation error for invalid email structure', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ Email: 'invalid-email-format' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.Email).toBeDefined();
    });

    it('should succeed, store hashed OTP in database, and capture the plain OTP via mocked email utility', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ Email: customerEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Nếu email tồn tại trong hệ thống, mã xác nhận đã được gửi.');
      
      expect(latestCapturedOtp).not.toBe('');
      expect(latestCapturedOtp).toHaveLength(6);
      expect(/^\d{6}$/.test(latestCapturedOtp)).toBe(true);

      // Verify the OTP is created in database
      const dbOtp = await prisma.passwordResetOtp.findFirst({
        where: { MaTaiKhoan: customerAccount.MaTaiKhoan, DaSuDung: false },
      });
      expect(dbOtp).toBeDefined();
      expect(dbOtp?.OtpHash).not.toBe(latestCapturedOtp); // Hashed OTP should not match plain OTP
    });
  });

  describe('2. POST /api/v1/auth/verify-reset-otp', () => {
    it('should return validation error if OTP is not 6 digits', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-reset-otp')
        .send({ Email: customerEmail, Otp: '12345' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should fail with 400 for wrong OTP and increment SoLanThu in DB', async () => {
      // First request forgotten password to ensure active OTP exists
      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ Email: customerEmail });

      const wrongOtp = latestCapturedOtp === '111111' ? '222222' : '111111';

      const res = await request(app)
        .post('/api/v1/auth/verify-reset-otp')
        .send({ Email: customerEmail, Otp: wrongOtp });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('không hợp lệ');

      // Check DB attempt count
      const dbOtp = await prisma.passwordResetOtp.findFirst({
        where: { MaTaiKhoan: customerAccount.MaTaiKhoan, DaSuDung: false },
      });
      expect(dbOtp?.SoLanThu).toBe(1);
    });

    it('should block verification (lock) after 5 wrong attempts', async () => {
      // Create new OTP
      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ Email: customerEmail });

      const activeOtp = await prisma.passwordResetOtp.findFirst({
        where: { MaTaiKhoan: customerAccount.MaTaiKhoan, DaSuDung: false },
      });
      expect(activeOtp).toBeDefined();

      // Manually set SoLanThu to 5 in DB
      await prisma.passwordResetOtp.update({
        where: { MaOtp: activeOtp!.MaOtp },
        data: { SoLanThu: 5 },
      });

      // Try verifying with correct OTP now
      const res = await request(app)
        .post('/api/v1/auth/verify-reset-otp')
        .send({ Email: customerEmail, Otp: latestCapturedOtp });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('bị khóa');
    });

    it('should fail if the OTP is expired', async () => {
      // Generate new OTP
      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ Email: customerEmail });

      const activeOtp = await prisma.passwordResetOtp.findFirst({
        where: { MaTaiKhoan: customerAccount.MaTaiKhoan, DaSuDung: false },
      });

      // Manually expire the OTP
      await prisma.passwordResetOtp.update({
        where: { MaOtp: activeOtp!.MaOtp },
        data: { HetHanLuc: new Date(Date.now() - 1000) },
      });

      const res = await request(app)
        .post('/api/v1/auth/verify-reset-otp')
        .send({ Email: customerEmail, Otp: latestCapturedOtp });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('không tồn tại hoặc đã hết hạn');
    });

    it('should succeed with 200 for correct email and OTP', async () => {
      // Generate new active OTP
      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ Email: customerEmail });

      const res = await request(app)
        .post('/api/v1/auth/verify-reset-otp')
        .send({ Email: customerEmail, Otp: latestCapturedOtp });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Mã xác nhận hợp lệ.');
    });
  });

  describe('3. POST /api/v1/auth/reset-password', () => {
    it('should fail if passwords do not match', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          Email: customerEmail,
          Otp: latestCapturedOtp,
          MatKhauMoi: 'newpassword123',
          XacNhanMatKhauMoi: 'mismatchpassword',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should reset password successfully, mark OTP as used, revoke refresh tokens, and block old password login', async () => {
      // 1. Generate new active OTP
      await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ Email: customerEmail });

      const currentOtp = latestCapturedOtp;

      // Create a dummy refresh token for this user
      const dummyToken = await prisma.refreshToken.create({
        data: {
          MaTaiKhoan: customerAccount.MaTaiKhoan,
          TokenHash: 'dummy_hash_for_forgot_pass',
          HetHanLuc: new Date(Date.now() + 3600000),
          BiThuHoi: false,
        },
      });

      // 2. Perform reset
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          Email: customerEmail,
          Otp: currentOtp,
          MatKhauMoi: 'newpassword123',
          XacNhanMatKhauMoi: 'newpassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.');

      // 3. Verify OTP is marked as used in DB
      const usedOtp = await prisma.passwordResetOtp.findFirst({
        where: { MaTaiKhoan: customerAccount.MaTaiKhoan, OtpHash: { not: '' } },
        orderBy: { NgayTao: 'desc' },
      });
      expect(usedOtp?.DaSuDung).toBe(true);

      // 4. Verify dummy refresh token is revoked
      const updatedToken = await prisma.refreshToken.findUnique({
        where: { MaRefreshToken: dummyToken.MaRefreshToken },
      });
      expect(updatedToken?.BiThuHoi).toBe(true);

      // 5. Login with OLD password should FAIL
      const loginOldRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          TenDangNhap: customerUsername,
          MatKhau: originalPassword,
        });
      expect(loginOldRes.status).toBe(401);
      expect(loginOldRes.body.success).toBe(false);

      // 6. Login with NEW password should SUCCEED
      const loginNewRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          TenDangNhap: customerUsername,
          MatKhau: 'newpassword123',
        });
      expect(loginNewRes.status).toBe(200);
      expect(loginNewRes.body.success).toBe(true);
      expect(loginNewRes.body.data.tokens.accessToken).toBeDefined();

      // 7. Reusing same OTP should fail
      const reuseRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          Email: customerEmail,
          Otp: currentOtp,
          MatKhauMoi: 'anotherpassword123',
          XacNhanMatKhauMoi: 'anotherpassword123',
        });
      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.success).toBe(false);
    });
  });
});
