import request from 'supertest';
import {
  PhuongThucThanhToan,
  TrangThaiGheSuatChieu,
  TrangThaiGiaoDich,
  TrangThaiPhieuDatVe,
} from '@prisma/client';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import {
  cleanupTestData,
  createTestAdmin,
  createTestCustomer,
  loginAndGetToken,
} from '../helpers';

describe('Booking QR admission', () => {
  let adminToken: string;
  let customerToken: string;
  let customerId: string;

  beforeAll(async () => {
    await cleanupTestData();
    await createTestAdmin('admission_admin');
    const account = await createTestCustomer('admission_customer');
    const customer = await prisma.khachHang.findUniqueOrThrow({
      where: { MaTaiKhoan: account.MaTaiKhoan },
    });
    customerId = customer.MaKhachHang;
    adminToken = await loginAndGetToken(app, 'admission_admin');
    customerToken = await loginAndGetToken(app, 'admission_customer');
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  const createPaidBooking = async (
    startOffsetMinutes = 10,
    bookingStatus: TrangThaiPhieuDatVe = TrangThaiPhieuDatVe.DA_THANH_TOAN,
    transactionStatus: TrangThaiGiaoDich = TrangThaiGiaoDich.THANH_CONG,
  ) => {
    const showtimeStart = new Date(Date.now() + startOffsetMinutes * 60 * 1000);
    const movie = await prisma.phim.create({
      data: {
        TenPhim: 'QR Admission Movie',
        TheLoai: 'Action',
        ThoiLuong: 120,
        NgayKhoiChieu: new Date(),
        GioiHanTuoi: 'P',
        Trailer: 'https://example.com/trailer',
      },
    });
    const roomType = await prisma.loaiPhong.create({
      data: { TenLoaiPhong: 'QR Standard', PhuThu: 0 },
    });
    const seatMap = await prisma.soDoGhe.create({
      data: { TenSoDo: 'QR 1x2', SoHang: 1, SoCot: 2 },
    });
    const room = await prisma.phongChieu.create({
      data: {
        TenPhong: 'QR Room',
        MaLoaiPhong: roomType.MaLoaiPhong,
        MaSoDo: seatMap.MaSoDo,
      },
    });
    const dayType = await prisma.loaiNgay.create({
      data: { TenLoaiNgay: 'QR Weekday', PhuThu: 0 },
    });
    const seatType = await prisma.loaiGhe.create({
      data: { TenLoaiGhe: 'QR Seat', PhuThu: 0 },
    });
    const showtime = await prisma.suatChieu.create({
      data: {
        MaPhim: movie.MaPhim,
        MaPhong: room.MaPhong,
        MaLoaiNgay: dayType.MaLoaiNgay,
        NgayChieu: showtimeStart,
        GioChieu: showtimeStart,
        GiaVeGoc: 50000,
      },
    });

    const seats = await Promise.all(
      [1, 2].map((column) =>
        prisma.ghe.create({
          data: {
            ViTriDay: 'A',
            ViTriCot: column,
            MaPhong: room.MaPhong,
            MaLoaiGhe: seatType.MaLoaiGhe,
          },
        }),
      ),
    );
    const showtimeSeats = await Promise.all(
      seats.map((seat) =>
        prisma.gheSuatChieu.create({
          data: {
            MaSuatChieu: showtime.MaSuatChieu,
            MaGhe: seat.MaGhe,
            TrangThai: TrangThaiGheSuatChieu.DA_DAT,
            GiaVe: 50000,
          },
        }),
      ),
    );
    const booking = await prisma.phieuDatVe.create({
      data: {
        MaKhachHang: customerId,
        TongTien: 100000,
        TrangThai: bookingStatus,
      },
    });

    await prisma.chiTietDatVe.createMany({
      data: showtimeSeats.map((seat) => ({
        MaPhieuDat: booking.MaPhieuDat,
        MaGheSuatChieu: seat.MaGheSuatChieu,
        GiaVe: 50000,
      })),
    });
    await prisma.giaoDich.create({
      data: {
        MaPhieuDat: booking.MaPhieuDat,
        PhuongThuc: PhuongThucThanhToan.VNPAY,
        SoTien: 100000,
        TrangThai: transactionStatus,
      },
    });

    return booking;
  };

  it('checks in every seat in a paid booking with one QR payload', async () => {
    const booking = await createPaidBooking();

    const response = await request(app)
      .post('/api/v1/admin/admission/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ QRPayload: `QR_${booking.MaPhieuDat}` });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      MaPhieuDat: booking.MaPhieuDat,
      DaCheckIn: true,
      SoLuongGhe: 2,
    });
    expect(response.body.data.ThoiGianCheckIn).toEqual(expect.any(String));

    const rows = await prisma.$queryRaw<Array<{ DaCheckIn: number }>>`
      SELECT DaCheckIn FROM phieu_dat_ve WHERE MaPhieuDat = ${booking.MaPhieuDat}
    `;
    expect(Boolean(rows[0]?.DaCheckIn)).toBe(true);
  });

  it('allows only Admin accounts to use the admission endpoint', async () => {
    const booking = await createPaidBooking();

    const response = await request(app)
      .post('/api/v1/admin/admission/check-in')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ QRPayload: `QR_${booking.MaPhieuDat}` });

    expect(response.status).toBe(403);
  });

  it('rejects a valid paid booking when the QR is scanned too early', async () => {
    const booking = await createPaidBooking(31);

    const response = await request(app)
      .post('/api/v1/admin/admission/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ QRPayload: `QR_${booking.MaPhieuDat}` });

    expect(response.status).toBe(400);

    const rows = await prisma.$queryRaw<Array<{ DaCheckIn: number }>>`
      SELECT DaCheckIn FROM phieu_dat_ve WHERE MaPhieuDat = ${booking.MaPhieuDat}
    `;
    expect(Boolean(rows[0]?.DaCheckIn)).toBe(false);
  });

  it('rejects a paid booking after the movie has ended', async () => {
    const booking = await createPaidBooking(-130);

    const response = await request(app)
      .post('/api/v1/admin/admission/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ QRPayload: `QR_${booking.MaPhieuDat}` });

    expect(response.status).toBe(400);

    const rows = await prisma.$queryRaw<Array<{ DaCheckIn: number }>>`
      SELECT DaCheckIn FROM phieu_dat_ve WHERE MaPhieuDat = ${booking.MaPhieuDat}
    `;
    expect(Boolean(rows[0]?.DaCheckIn)).toBe(false);
  });

  it('rejects a booking with a pending refund request', async () => {
    const booking = await createPaidBooking();
    const transaction = await prisma.giaoDich.findFirstOrThrow({
      where: { MaPhieuDat: booking.MaPhieuDat },
    });
    await prisma.lichSuHoanTien.create({
      data: {
        MaGiaoDich: transaction.MaGiaoDich,
        SoTienHoan: 100000,
        LyDo: 'Customer requested a refund',
        TrangThai: 'CHO_XU_LY',
      },
    });

    const response = await request(app)
      .post('/api/v1/admin/admission/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ QRPayload: `QR_${booking.MaPhieuDat}` });

    expect(response.status).toBe(400);

    const rows = await prisma.$queryRaw<Array<{ DaCheckIn: number }>>`
      SELECT DaCheckIn FROM phieu_dat_ve WHERE MaPhieuDat = ${booking.MaPhieuDat}
    `;
    expect(Boolean(rows[0]?.DaCheckIn)).toBe(false);
  });

  it('rejects a malformed booking QR payload during validation', async () => {
    const response = await request(app)
      .post('/api/v1/admin/admission/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ QRPayload: 'QR_not-a-booking-id' });

    expect(response.status).toBe(422);
  });

  it('explains that an unpaid booking cannot be checked in', async () => {
    const booking = await createPaidBooking(
      10,
      TrangThaiPhieuDatVe.CHO_THANH_TOAN,
      TrangThaiGiaoDich.CHO_XU_LY,
    );

    const response = await request(app)
      .post('/api/v1/admin/admission/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ QRPayload: `QR_${booking.MaPhieuDat}` });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Thanh toán chưa hoàn tất');
  });

  it('rejects a second scan without changing the first check-in time', async () => {
    const booking = await createPaidBooking();
    const payload = { QRPayload: `QR_${booking.MaPhieuDat}` };

    const first = await request(app)
      .post('/api/v1/admin/admission/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    const second = await request(app)
      .post('/api/v1/admin/admission/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(second.body.message).toBe('Vé đã được sử dụng');

    const stored = await prisma.phieuDatVe.findUniqueOrThrow({
      where: { MaPhieuDat: booking.MaPhieuDat },
    });
    expect(stored.ThoiGianCheckIn?.toISOString()).toBe(
      first.body.data.ThoiGianCheckIn,
    );
  });

  it('blocks a customer refund request after the booking was checked in', async () => {
    const booking = await createPaidBooking();
    const checkIn = await request(app)
      .post('/api/v1/admin/admission/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ QRPayload: `QR_${booking.MaPhieuDat}` });
    expect(checkIn.status).toBe(200);

    const refund = await request(app)
      .post('/api/v1/hoan-tien/yeu-cau')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        MaPhieuDat: booking.MaPhieuDat,
        LyDo: 'Changed my mind after entry',
        TenNganHang: 'Test Bank',
        SoTaiKhoan: '123456789',
        TenChuTaiKhoan: 'Admission Customer',
      });

    expect(refund.status).toBe(400);
    expect(refund.body.message).toContain('đã check-in');
    expect(
      await prisma.lichSuHoanTien.count({
        where: { GiaoDich: { MaPhieuDat: booking.MaPhieuDat } },
      }),
    ).toBe(0);
  });

  it('blocks customer cancellation after the booking was checked in', async () => {
    const booking = await createPaidBooking();
    const checkIn = await request(app)
      .post('/api/v1/admin/admission/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ QRPayload: `QR_${booking.MaPhieuDat}` });
    expect(checkIn.status).toBe(200);

    const cancellation = await request(app)
      .post(`/api/v1/dat-ve/${booking.MaPhieuDat}/huy`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        LyDoHoan: 'Cancel after entry',
        TenNganHang: 'Test Bank',
        SoTaiKhoan: '123456789',
        TenChuTaiKhoan: 'Admission Customer',
      });

    expect(cancellation.status).toBe(400);
    expect(cancellation.body.message).toContain('đã check-in');

    const stored = await prisma.phieuDatVe.findUniqueOrThrow({
      where: { MaPhieuDat: booking.MaPhieuDat },
    });
    expect(stored.TrangThai).toBe(TrangThaiPhieuDatVe.DA_THANH_TOAN);
  });

  it('blocks an admin direct refund after the booking was checked in', async () => {
    const booking = await createPaidBooking();
    const transaction = await prisma.giaoDich.findFirstOrThrow({
      where: { MaPhieuDat: booking.MaPhieuDat },
    });
    const checkIn = await request(app)
      .post('/api/v1/admin/admission/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ QRPayload: `QR_${booking.MaPhieuDat}` });
    expect(checkIn.status).toBe(200);

    const refund = await request(app)
      .post(`/api/v1/admin/giao-dich/${transaction.MaGiaoDich}/hoan-tien`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ SoTienHoan: 100000, LyDo: 'Refund after entry' });

    expect(refund.status).toBe(400);
    expect(refund.body.message).toContain('đã check-in');

    const stored = await prisma.giaoDich.findUniqueOrThrow({
      where: { MaGiaoDich: transaction.MaGiaoDich },
    });
    expect(stored.TrangThai).toBe(TrangThaiGiaoDich.THANH_CONG);
  });

  it('blocks an admin cancellation after the booking was checked in', async () => {
    const booking = await createPaidBooking();
    const checkIn = await request(app)
      .post('/api/v1/admin/admission/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ QRPayload: `QR_${booking.MaPhieuDat}` });
    expect(checkIn.status).toBe(200);

    const cancellation = await request(app)
      .patch(`/api/v1/admin/giao-dich/phieu-dat/${booking.MaPhieuDat}/huy`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(cancellation.status).toBe(400);
    expect(cancellation.body.message).toContain('đã check-in');

    const stored = await prisma.phieuDatVe.findUniqueOrThrow({
      where: { MaPhieuDat: booking.MaPhieuDat },
    });
    expect(stored.TrangThai).toBe(TrangThaiPhieuDatVe.DA_THANH_TOAN);
  });

  it('returns one booking QR from the customer ticket detail API', async () => {
    const booking = await createPaidBooking();

    const response = await request(app)
      .get(`/api/v1/lich-su-giao-dich/${booking.MaPhieuDat}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      MaPhieuDat: booking.MaPhieuDat,
      QRPayload: `QR_${booking.MaPhieuDat}`,
      DaCheckIn: false,
      ThoiGianCheckIn: null,
    });
  });

  it('allows exactly one of two concurrent scans to check in', async () => {
    const booking = await createPaidBooking();
    const payload = { QRPayload: `QR_${booking.MaPhieuDat}` };

    const responses = await Promise.all([
      request(app)
        .post('/api/v1/admin/admission/check-in')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload),
      request(app)
        .post('/api/v1/admin/admission/check-in')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200,
      400,
    ]);
  });
});
