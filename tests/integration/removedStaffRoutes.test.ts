import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { cleanupTestData, createTestAdmin, loginAndGetToken } from '../helpers';

const removedRoutes = [
  ['get', '/api/v1/staff/ho-so'],
  ['get', '/api/v1/staff/lich-lam-viec/cua-toi'],
  ['get', '/api/v1/staff/ban-ve/suat-chieu'],
  ['post', '/api/v1/staff/soat-ve/kiem-tra'],
  ['get', '/api/v1/staff/dashboard'],
  ['get', '/api/v1/admin/ca-lam-viec'],
] as const;

describe('removed Staff HTTP surface', () => {
  let adminToken: string;

  beforeAll(async () => {
    await cleanupTestData();
    await createTestAdmin('admin_removed_staff_routes');
    adminToken = await loginAndGetToken(app, 'admin_removed_staff_routes');
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it.each(removedRoutes)('%s %s returns 404', async (method, url) => {
    const response = method === 'get'
      ? await request(app).get(url).set('Authorization', `Bearer ${adminToken}`)
      : await request(app)
          .post(url)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ MaChiTietDat: '00000000-0000-0000-0000-000000000000' });

    expect(response.status).toBe(404);
  });
});
