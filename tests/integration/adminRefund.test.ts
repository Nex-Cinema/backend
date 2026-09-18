import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { cleanupTestData, createTestAdmin, createTestCustomer, createTestMovie, createTicketDetailForMovie, loginAndGetToken } from '../helpers';

describe('Admin refund transitions', () => {
  let token: string;
  let customerToken: string;
  let failSeatRelease = false;
  beforeAll(() => {
    prisma.$use(async (params, next) => {
      if (failSeatRelease && params.model === 'GheSuatChieu' && params.action === 'updateMany') {
        throw new Error('Injected seat release failure');
      }
      return next(params);
    });
  });
  afterEach(() => { failSeatRelease = false; });

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
    expect((await prisma.phieuDatVe.findUniqueOrThrow({ where: { MaPhieuDat: ticket.MaPhieuDat } })).TrangThai).toBe('DA_HUY');
  });

  it('cannot approve a rejected request', async () => {
    const { refund, transaction } = await fixture();
    expect((await reject(refund.MaHoanTien)).status).toBe(200);
    expect((await approve(refund.MaHoanTien)).status).toBe(400);
    expect((await prisma.giaoDich.findUniqueOrThrow({ where: { MaGiaoDich: transaction.MaGiaoDich } })).TrangThai).toBe('THANH_CONG');
  });

  it('accepts exactly one of eight concurrent approvals', async () => {
    const { refund } = await fixture();
    const responses = await Promise.all(Array.from({ length: 8 }, () => approve(refund.MaHoanTien)));
    expect(responses.filter(r => r.status === 200)).toHaveLength(1);
    expect(responses.filter(r => r.status === 400)).toHaveLength(7);
  });

  it('approval and rejection cannot both succeed', async () => {
    const { refund, transaction } = await fixture();
    const responses = await Promise.all([approve(refund.MaHoanTien), reject(refund.MaHoanTien)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 400]);
    const dbRefund = await prisma.lichSuHoanTien.findUniqueOrThrow({ where: { MaHoanTien: refund.MaHoanTien } });
    const dbTx = await prisma.giaoDich.findUniqueOrThrow({ where: { MaGiaoDich: transaction.MaGiaoDich } });
    expect(dbTx.TrangThai).toBe(dbRefund.TrangThai === 'DA_HOAN' ? 'DA_HOAN_TIEN' : 'THANH_CONG');
  });

  it('rolls back every state change if seat release fails', async () => {
    const { refund, transaction, ticket } = await fixture();
    failSeatRelease = true;
    const response = await approve(refund.MaHoanTien);
    failSeatRelease = false;
    expect(response.status).toBe(500);
    expect((await prisma.lichSuHoanTien.findUniqueOrThrow({ where: { MaHoanTien: refund.MaHoanTien } })).TrangThai).toBe('CHO_XU_LY');
    expect((await prisma.giaoDich.findUniqueOrThrow({ where: { MaGiaoDich: transaction.MaGiaoDich } })).TrangThai).toBe('THANH_CONG');
    expect((await prisma.phieuDatVe.findUniqueOrThrow({ where: { MaPhieuDat: ticket.MaPhieuDat } })).TrangThai).toBe('DA_THANH_TOAN');
    expect((await prisma.gheSuatChieu.findUniqueOrThrow({ where: { MaGheSuatChieu: ticket.MaGheSuatChieu } })).TrangThai).toBe('DA_DAT');
  });

  it('does not approve a request whose transaction is already refunded', async () => {
    const { refund, transaction } = await fixture();
    await prisma.giaoDich.update({ where: { MaGiaoDich: transaction.MaGiaoDich }, data: { TrangThai: 'DA_HOAN_TIEN' } });
    expect((await approve(refund.MaHoanTien)).status).toBe(400);
    expect((await prisma.lichSuHoanTien.findUniqueOrThrow({ where: { MaHoanTien: refund.MaHoanTien } })).TrangThai).toBe('CHO_XU_LY');
  });

  it.each(['DANG_GIU', 'DA_DAT'] as const)('preserves a newer %s reservation on the same seat', async (state) => {
    const { refund, ticket } = await fixture();
    await prisma.phieuDatVe.update({ where: { MaPhieuDat: ticket.MaPhieuDat }, data: { TrangThai: 'DA_HUY' } });
    const newer = await prisma.phieuDatVe.create({ data: { TongTien: 50000, TrangThai: state === 'DA_DAT' ? 'DA_THANH_TOAN' : 'CHO_THANH_TOAN' } });
    await prisma.chiTietDatVe.create({ data: { MaPhieuDat: newer.MaPhieuDat, MaGheSuatChieu: ticket.MaGheSuatChieu, GiaVe: 50000 } });
    await prisma.gheSuatChieu.update({ where: { MaGheSuatChieu: ticket.MaGheSuatChieu }, data: { TrangThai: state } });
    expect((await approve(refund.MaHoanTien)).status).toBe(200);
    expect((await prisma.gheSuatChieu.findUniqueOrThrow({ where: { MaGheSuatChieu: ticket.MaGheSuatChieu } })).TrangThai).toBe(state);
  });

  function directRefund(id: string) {
    return request(app).post(`/api/v1/admin/giao-dich/${id}/hoan-tien`).set('Authorization', `Bearer ${token}`).send({ SoTienHoan: 50000, LyDo: 'Manual refund recorded' });
  }

  it('rejects direct refund when a pending request exists', async () => {
    const { transaction } = await fixture();
    expect((await directRefund(transaction.MaGiaoDich)).status).toBe(400);
    expect((await prisma.giaoDich.findUniqueOrThrow({ where: { MaGiaoDich: transaction.MaGiaoDich } })).TrangThai).toBe('THANH_CONG');
  });

  it('records only one history row for concurrent direct refunds', async () => {
    const { refund, transaction } = await fixture();
    await prisma.lichSuHoanTien.delete({ where: { MaHoanTien: refund.MaHoanTien } });
    const responses = await Promise.all([directRefund(transaction.MaGiaoDich), directRefund(transaction.MaGiaoDich)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 400]);
    expect(await prisma.lichSuHoanTien.count({ where: { MaGiaoDich: transaction.MaGiaoDich } })).toBe(1);
  });

  it('approval racing a direct refund settles only once', async () => {
    const { refund, transaction } = await fixture();
    const responses = await Promise.all([approve(refund.MaHoanTien), directRefund(transaction.MaGiaoDich)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 400]);
    expect(await prisma.lichSuHoanTien.count({ where: { MaGiaoDich: transaction.MaGiaoDich, TrangThai: 'DA_HOAN' } })).toBe(1);
  });
});
