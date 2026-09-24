import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import {
  cleanupTestData,
  createTestAdmin,
  createTestCustomer,
  createTestStaff,
  loginAndGetToken,
} from '../helpers';

describe('📅 Staff Shift Management Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let staffToken1: string;
  let staffToken2: string;
  let staffAccount1: any;
  let staffAccount2: any;

  let shiftTemplate1: any; // capacity 2
  let shiftTemplate2: any; // capacity 1
  let shiftTemplateOverlapping: any; // overlaps with template 1

  beforeAll(async () => {
    await cleanupTestData();

    // Create accounts
    await createTestAdmin('admin_shift_test', 'password123');
    await createTestCustomer('cust_shift_test', 'password123');
    staffAccount1 = await createTestStaff('staff_shift_test1', 'password123');
    const nv1 = await prisma.nhanVien.findFirst({ where: { MaTaiKhoan: staffAccount1.MaTaiKhoan } });
    staffAccount1.NhanVien = nv1;

    staffAccount2 = await createTestStaff('staff_shift_test2', 'password123');
    const nv2 = await prisma.nhanVien.findFirst({ where: { MaTaiKhoan: staffAccount2.MaTaiKhoan } });
    staffAccount2.NhanVien = nv2;

    // Login and get tokens
    adminToken = await loginAndGetToken(app, 'admin_shift_test', 'password123');
    customerToken = await loginAndGetToken(app, 'cust_shift_test', 'password123');
    staffToken1 = await loginAndGetToken(app, 'staff_shift_test1', 'password123');
    staffToken2 = await loginAndGetToken(app, 'staff_shift_test2', 'password123');
  });

  beforeEach(async () => {
    await prisma.cauHinhVanHanh.upsert({
      where: { Id: 1 },
      update: { ThoiGianGiuGhePhut: 10, CuaSoCheckInPhut: 30, HanHuyCaTruocGio: 2 },
      create: { Id: 1, ThoiGianGiuGhePhut: 10, CuaSoCheckInPhut: 30, HanHuyCaTruocGio: 2 },
    });
    // Clear registrations and shifts before each test
    await prisma.chiTietCaLamViec.deleteMany({});
    await prisma.caLamViec.deleteMany({});

    // Seed Shift Templates
    // Shift 1: 08:00 - 12:00 (capacity 2)
    shiftTemplate1 = await prisma.caLamViec.create({
      data: {
        TenCa: 'Ca Sáng A',
        GioBatDau: new Date('1970-01-01T08:00:00Z'),
        GioKetThuc: new Date('1970-01-01T12:00:00Z'),
        SoNguoiToiDa: 2,
        KhaDung: true,
      },
    });

    // Shift 2: 13:00 - 17:00 (capacity 1)
    shiftTemplate2 = await prisma.caLamViec.create({
      data: {
        TenCa: 'Ca Chieu B',
        GioBatDau: new Date('1970-01-01T13:00:00Z'),
        GioKetThuc: new Date('1970-01-01T17:00:00Z'),
        SoNguoiToiDa: 1,
        KhaDung: true,
      },
    });

    // Overlapping Shift: 10:00 - 14:00 (capacity 1)
    shiftTemplateOverlapping = await prisma.caLamViec.create({
      data: {
        TenCa: 'Ca Trưa Overlap',
        GioBatDau: new Date('1970-01-01T10:00:00Z'),
        GioKetThuc: new Date('1970-01-01T14:00:00Z'),
        SoNguoiToiDa: 1,
        KhaDung: true,
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('GET /api/v1/staff/lich-lam-viec/ca-lam', () => {
    it('1. STAFF can view active shift templates without date', async () => {
      const res = await request(app)
        .get('/api/v1/staff/lich-lam-viec/ca-lam')
        .set('Authorization', `Bearer ${staffToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.data[0]).toHaveProperty('MaCa');
      expect(res.body.data[0]).not.toHaveProperty('ConTrong');
      expect(res.body.data[0]).not.toHaveProperty('SoNguoiDaDangKy');
    });

    it('2. STAFF can view active shifts with date and dynamic counters', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Pre-register staff 1 to shift 1 tomorrow
      await prisma.chiTietCaLamViec.create({
        data: {
          MaNhanVien: staffAccount1.NhanVien.MaNhanVien,
          MaCa: shiftTemplate1.MaCa,
          NgayLamViec: new Date(tomorrowStr),
          KhaDung: true,
        },
      });

      const res = await request(app)
        .get(`/api/v1/staff/lich-lam-viec/ca-lam?ngayLamViec=${tomorrowStr}`)
        .set('Authorization', `Bearer ${staffToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      const s1 = res.body.data.find((s: any) => s.MaCa === shiftTemplate1.MaCa);
      expect(s1).toBeDefined();
      expect(s1.SoNguoiDaDangKy).toBe(1);
      expect(s1.SoNguoiToiDa).toBe(2);
      expect(s1.ConTrong).toBe(true);

      const s2 = res.body.data.find((s: any) => s.MaCa === shiftTemplate2.MaCa);
      expect(s2).toBeDefined();
      expect(s2.SoNguoiDaDangKy).toBe(0);
      expect(s2.SoNguoiToiDa).toBe(1);
      expect(s2.ConTrong).toBe(true);
    });
  });

  describe('POST /api/v1/staff/lich-lam-viec/dang-ky', () => {
    it('3. STAFF can register available future shift', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/v1/staff/lich-lam-viec/dang-ky')
        .set('Authorization', `Bearer ${staffToken1}`)
        .send({
          MaCa: shiftTemplate1.MaCa,
          NgayLamViec: tomorrowStr,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Đăng ký ca làm thành công');

      // Verify db entry
      const reg = await prisma.chiTietCaLamViec.findFirst({
        where: {
          MaNhanVien: staffAccount1.NhanVien.MaNhanVien,
          MaCa: shiftTemplate1.MaCa,
          NgayLamViec: new Date(tomorrowStr),
        },
      });
      expect(reg).toBeDefined();
      expect(reg?.KhaDung).toBe(true);
    });

    it('4. STAFF cannot register past shift (yesterday)', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/v1/staff/lich-lam-viec/dang-ky')
        .set('Authorization', `Bearer ${staffToken1}`)
        .send({
          MaCa: shiftTemplate1.MaCa,
          NgayLamViec: yesterdayStr,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('trong quá khứ');
    });

    it('5. STAFF cannot register shift that has already started today', async () => {
      const now = new Date();
      // Seed a shift template starting 1 hour ago
      const pastTime = new Date(now.getTime() - 60 * 60 * 1000);
      const shiftPast = await prisma.caLamViec.create({
        data: {
          TenCa: 'Ca Đã Qua',
          GioBatDau: pastTime,
          GioKetThuc: now,
          SoNguoiToiDa: 1,
          KhaDung: true,
        },
      });

      const todayStr = now.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/v1/staff/lich-lam-viec/dang-ky')
        .set('Authorization', `Bearer ${staffToken1}`)
        .send({
          MaCa: shiftPast.MaCa,
          NgayLamViec: todayStr,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('đã hoặc đang diễn ra');
    });

    it('6. STAFF cannot register duplicate shift', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // First registration
      await request(app)
        .post('/api/v1/staff/lich-lam-viec/dang-ky')
        .set('Authorization', `Bearer ${staffToken1}`)
        .send({
          MaCa: shiftTemplate1.MaCa,
          NgayLamViec: tomorrowStr,
        });

      // Duplicate registration
      const res = await request(app)
        .post('/api/v1/staff/lich-lam-viec/dang-ky')
        .set('Authorization', `Bearer ${staffToken1}`)
        .send({
          MaCa: shiftTemplate1.MaCa,
          NgayLamViec: tomorrowStr,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('đã đăng ký ca làm việc này');
    });

    it('7. STAFF cannot register overlapping shifts', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Register shift 1 (08:00 - 12:00)
      await request(app)
        .post('/api/v1/staff/lich-lam-viec/dang-ky')
        .set('Authorization', `Bearer ${staffToken1}`)
        .send({
          MaCa: shiftTemplate1.MaCa,
          NgayLamViec: tomorrowStr,
        });

      // Register overlapping shift (10:00 - 14:00)
      const res = await request(app)
        .post('/api/v1/staff/lich-lam-viec/dang-ky')
        .set('Authorization', `Bearer ${staffToken1}`)
        .send({
          MaCa: shiftTemplateOverlapping.MaCa,
          NgayLamViec: tomorrowStr,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('trùng giờ');
    });

    it('8. STAFF cannot register when capacity is full', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Shift 2 has capacity = 1
      // Register staff 1
      await request(app)
        .post('/api/v1/staff/lich-lam-viec/dang-ky')
        .set('Authorization', `Bearer ${staffToken1}`)
        .send({
          MaCa: shiftTemplate2.MaCa,
          NgayLamViec: tomorrowStr,
        });

      // Register staff 2 -> should fail
      const res = await request(app)
        .post('/api/v1/staff/lich-lam-viec/dang-ky')
        .set('Authorization', `Bearer ${staffToken2}`)
        .send({
          MaCa: shiftTemplate2.MaCa,
          NgayLamViec: tomorrowStr,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('đủ số lượng nhân viên');
    });
  });

  describe('GET /api/v1/staff/lich-lam-viec/cua-toi', () => {
    it('9. STAFF can view their own schedule only (properly sorted)', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);
      const dayAfterStr = dayAfter.toISOString().split('T')[0];

      // Create registration for staff 1 tomorrow (Shift 1: 08:00)
      await prisma.chiTietCaLamViec.create({
        data: {
          MaNhanVien: staffAccount1.NhanVien.MaNhanVien,
          MaCa: shiftTemplate1.MaCa,
          NgayLamViec: new Date(tomorrowStr),
        },
      });

      // Create registration for staff 1 tomorrow (Shift 2: 13:00)
      await prisma.chiTietCaLamViec.create({
        data: {
          MaNhanVien: staffAccount1.NhanVien.MaNhanVien,
          MaCa: shiftTemplate2.MaCa,
          NgayLamViec: new Date(tomorrowStr),
        },
      });

      // Create registration for staff 1 day after tomorrow (Shift 1: 08:00)
      await prisma.chiTietCaLamViec.create({
        data: {
          MaNhanVien: staffAccount1.NhanVien.MaNhanVien,
          MaCa: shiftTemplate1.MaCa,
          NgayLamViec: new Date(dayAfterStr),
        },
      });

      // Create registration for staff 2 tomorrow
      await prisma.chiTietCaLamViec.create({
        data: {
          MaNhanVien: staffAccount2.NhanVien.MaNhanVien,
          MaCa: shiftTemplate1.MaCa,
          NgayLamViec: new Date(tomorrowStr),
        },
      });

      const res = await request(app)
        .get('/api/v1/staff/lich-lam-viec/cua-toi')
        .set('Authorization', `Bearer ${staffToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);

      // Verify sorting: sorted by NgayLamViec asc, GioBatDau asc
      const first = res.body.data[0];
      const second = res.body.data[1];
      const third = res.body.data[2];

      expect(new Date(first.NgayLamViec).getDate()).toBe(tomorrow.getDate());
      expect(first.CaLamViec.TenCa).toBe('Ca Sáng A');

      expect(new Date(second.NgayLamViec).getDate()).toBe(tomorrow.getDate());
      expect(second.CaLamViec.TenCa).toBe('Ca Chieu B');

      expect(new Date(third.NgayLamViec).getDate()).toBe(dayAfter.getDate());
      expect(third.CaLamViec.TenCa).toBe('Ca Sáng A');
    });
  });

  describe('PATCH /api/v1/staff/lich-lam-viec/:maChiTietCa/huy', () => {
    it('10. STAFF can cancel own shift if requested >= 2 hours before start', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Register staff 1 tomorrow (more than 2 hours away)
      const reg = await prisma.chiTietCaLamViec.create({
        data: {
          MaNhanVien: staffAccount1.NhanVien.MaNhanVien,
          MaCa: shiftTemplate1.MaCa,
          NgayLamViec: new Date(tomorrowStr),
          KhaDung: true,
        },
      });

      const res = await request(app)
        .patch(`/api/v1/staff/lich-lam-viec/${reg.MaChiTietCa}/huy`)
        .set('Authorization', `Bearer ${staffToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Hủy ca làm thành công');

      // Verify soft-deleted
      const deletedReg = await prisma.chiTietCaLamViec.findUnique({
        where: { MaChiTietCa: reg.MaChiTietCa },
      });
      expect(deletedReg?.KhaDung).toBe(false);
    });

    it('11. STAFF cannot cancel another staff\'s shift', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Register staff 1
      const reg = await prisma.chiTietCaLamViec.create({
        data: {
          MaNhanVien: staffAccount1.NhanVien.MaNhanVien,
          MaCa: shiftTemplate1.MaCa,
          NgayLamViec: new Date(tomorrowStr),
          KhaDung: true,
        },
      });

      // Try cancel by staff 2
      const res = await request(app)
        .patch(`/api/v1/staff/lich-lam-viec/${reg.MaChiTietCa}/huy`)
        .set('Authorization', `Bearer ${staffToken2}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('không có quyền');
    });

    it('12. STAFF cannot cancel shift within 2 hours of shift start', async () => {
      const now = new Date();
      // Seed shift starting in 1 hour
      const nearTime = new Date(now.getTime() + 60 * 60 * 1000);
      const shiftNear = await prisma.caLamViec.create({
        data: {
          TenCa: 'Ca Sắp Bắt Đầu',
          GioBatDau: nearTime,
          GioKetThuc: new Date(now.getTime() + 5 * 60 * 60 * 1000),
          SoNguoiToiDa: 1,
          KhaDung: true,
        },
      });

      const todayStr = now.toISOString().split('T')[0];

      const reg = await prisma.chiTietCaLamViec.create({
        data: {
          MaNhanVien: staffAccount1.NhanVien.MaNhanVien,
          MaCa: shiftNear.MaCa,
          NgayLamViec: new Date(todayStr),
          KhaDung: true,
        },
      });

      const res = await request(app)
        .patch(`/api/v1/staff/lich-lam-viec/${reg.MaChiTietCa}/huy`)
        .set('Authorization', `Bearer ${staffToken1}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('ít nhất 2 giờ');
    });

    it('applies the configured shift cancellation cutoff', async () => {
      await prisma.cauHinhVanHanh.update({
        where: { Id: 1 },
        data: { HanHuyCaTruocGio: 0 },
      });
      const now = new Date();
      const nearTime = new Date(now.getTime() + 60 * 60 * 1000);
      const shiftNear = await prisma.caLamViec.create({
        data: {
          TenCa: 'Ca Theo Policy',
          GioBatDau: nearTime,
          GioKetThuc: new Date(now.getTime() + 3 * 60 * 60 * 1000),
          SoNguoiToiDa: 1,
          KhaDung: true,
        },
      });
      const registration = await prisma.chiTietCaLamViec.create({
        data: {
          MaNhanVien: staffAccount1.NhanVien.MaNhanVien,
          MaCa: shiftNear.MaCa,
          NgayLamViec: new Date(now.toISOString().split('T')[0]),
          KhaDung: true,
        },
      });

      const res = await request(app)
        .patch(`/api/v1/staff/lich-lam-viec/${registration.MaChiTietCa}/huy`)
        .set('Authorization', `Bearer ${staffToken1}`);

      expect(res.status).toBe(200);
    });
  });

  describe('🔒 Role Access Control Rules', () => {
    it('13. CUSTOMER/ADMIN/Guest cannot access staff shift routes', async () => {
      // 13.1. CUSTOMER blocks
      const custRes1 = await request(app)
        .get('/api/v1/staff/lich-lam-viec/ca-lam')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(custRes1.status).toBe(403);

      const custRes2 = await request(app)
        .post('/api/v1/staff/lich-lam-viec/dang-ky')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ MaCa: shiftTemplate1.MaCa, NgayLamViec: '2026-06-01' });
      expect(custRes2.status).toBe(403);

      // 13.2. ADMIN blocks
      const adminRes1 = await request(app)
        .get('/api/v1/staff/lich-lam-viec/ca-lam')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes1.status).toBe(403);

      // 13.3. Guest blocks (unauthenticated)
      const guestRes = await request(app)
        .get('/api/v1/staff/lich-lam-viec/ca-lam');
      expect(guestRes.status).toBe(401);
    });
  });
});
