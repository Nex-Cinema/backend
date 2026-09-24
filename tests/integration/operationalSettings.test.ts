import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { cleanupTestData, createTestAdmin, createTestCustomer, loginAndGetToken } from '../helpers';

describe('Operational settings API', () => {
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    await cleanupTestData();
    await createTestAdmin('admin_operational_settings');
    await createTestCustomer('customer_operational_settings');
    adminToken = await loginAndGetToken(app, 'admin_operational_settings');
    customerToken = await loginAndGetToken(app, 'customer_operational_settings');
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('creates and returns typed defaults', async () => {
    const response = await request(app)
      .get('/api/v1/admin/cau-hinh-van-hanh')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      ThoiGianGiuGhePhut: 10,
      CuaSoCheckInPhut: 30,
      HanHuyCaTruocGio: 2,
    }));
  });

  it('supports validated partial updates', async () => {
    const response = await request(app)
      .patch('/api/v1/admin/cau-hinh-van-hanh')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ThoiGianGiuGhePhut: 12 });

    expect(response.status).toBe(200);
    expect(response.body.data.ThoiGianGiuGhePhut).toBe(12);
    expect(response.body.data.CuaSoCheckInPhut).toBe(30);
  });

  it('rejects invalid bounds and non-admin access', async () => {
    const invalid = await request(app)
      .patch('/api/v1/admin/cau-hinh-van-hanh')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ThoiGianGiuGhePhut: 61 });
    expect(invalid.status).toBe(400);

    const forbidden = await request(app)
      .get('/api/v1/admin/cau-hinh-van-hanh')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(forbidden.status).toBe(403);
  });
});
