import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { cleanupTestData, createTestAdmin, createTestCustomer, createTestMovie, createTicketDetailForMovie, loginAndGetToken } from '../helpers';

describe('Admin refund transitions', () => {
  let token: string;
  let customerToken: string;

  beforeEach(async () => {
    await cleanupTestData();
    await createTestAdmin();
    await createTestCustomer();
    token = await loginAndGetToken(app, 'test_admin');
    customerToken = await loginAndGetToken(app, 'test_customer');
  });
  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  async function fixture() {
    const movie = await createTestMovie();
    const ticket = await createTicketDetailForMovie(movie.MaPhim);
    const transaction = await prisma.giaoDich.create({ data: {
      MaPhieuDat: ticket.MaPhieuDat, SoTien: 50000, TrangThai: 'THANH_CONG', PhuongThuc: 'TIEN_MAT',
    } });
    const refund = await prisma.lichSuHoanTien.create({ data: {
      MaGiaoDich: transaction.MaGiaoDich, SoTienHoan: 50000, LyDo: 'Test cancellation', TrangThai: 'CHO_XU_LY',
    } });
    return { ticket, transaction, refund };
  }

  function approve(id: string, auth = token) {
    return request(app).patch(`/api/v1/admin/hoan-tien/${id}/duyet`).set('Authorization', `Bearer ${auth}`).send({});
  }
  function reject(id: string) {
    return request(app).patch(`/api/v1/admin/hoan-tien/${id}/tu-choi`).set('Authorization', `Bearer ${token}`).send({ LyDoTuChoi: 'Invalid request' });
  }

  it('rejects customer access without mutating the request', async () => {
    const { refund } = await fixture();
    expect((await approve(refund.MaHoanTien, customerToken)).status).toBe(403);
    expect((await prisma.lichSuHoanTien.findUniqueOrThrow({ where: { MaHoanTien: refund.MaHoanTien } })).TrangThai).toBe('CHO_XU_LY');
  });

  it('approves a pending request and rejects a sequential duplicate', async () => {
    const { refund, transaction, ticket } = await fixture();
    expect((await approve(refund.MaHoanTien)).status).toBe(200);
    expect((await approve(refund.MaHoanTien)).status).toBe(400);
    expect((await prisma.giaoDich.findUniqueOrThrow({ where: { MaGiaoDich: transaction.MaGiaoDich } })).TrangThai).toBe('DA_HOAN_TIEN');
    expect((await prisma.gheSuatChieu.findUniqueOrThrow({ where: { MaGheSuatChieu: ticket.MaGheSuatChieu } })).TrangThai).toBe('TRONG');
  });

  it('cannot approve a rejected request', async () => {
    const { refund, transaction } = await fixture();
    expect((await reject(refund.MaHoanTien)).status).toBe(200);
    expect((await approve(refund.MaHoanTien)).status).toBe(400);
    expect((await prisma.giaoDich.findUniqueOrThrow({ where: { MaGiaoDich: transaction.MaGiaoDich } })).TrangThai).toBe('THANH_CONG');
  });
});
