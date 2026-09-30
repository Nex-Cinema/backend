import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { cleanupTestData, createTestAdmin, createTestCustomer, loginAndGetToken } from '../helpers';

describe('Admin counter sale', () => {
  let adminToken: string;
  let customerToken: string;
  let showtimeId: string;
  let seatId: string;

  beforeAll(async () => {
    await cleanupTestData();
    await createTestAdmin('counter_admin');
    await createTestCustomer('counter_customer');
    adminToken = await loginAndGetToken(app, 'counter_admin');
    customerToken = await loginAndGetToken(app, 'counter_customer');

    const movie = await prisma.phim.create({
      data: { TenPhim: 'Counter Sale Movie', TheLoai: 'Drama', ThoiLuong: 100, NgayKhoiChieu: new Date(), GioiHanTuoi: 'P', Trailer: 'https://example.com/trailer' },
    });
    const roomType = await prisma.loaiPhong.create({ data: { TenLoaiPhong: 'Counter Room', PhuThu: 10000 } });
    const seatMap = await prisma.soDoGhe.create({ data: { TenSoDo: 'Counter 1x1', SoHang: 1, SoCot: 1 } });
    const room = await prisma.phongChieu.create({ data: { TenPhong: 'Counter 01', MaLoaiPhong: roomType.MaLoaiPhong, MaSoDo: seatMap.MaSoDo } });
    const dayType = await prisma.loaiNgay.create({ data: { TenLoaiNgay: 'Counter Day', PhuThu: 5000 } });
    const seatType = await prisma.loaiGhe.create({ data: { TenLoaiGhe: 'Counter Seat', PhuThu: 5000 } });
    const showtimeStart = new Date(Date.now() + 60 * 60 * 1000);
    const showtime = await prisma.suatChieu.create({
      data: { MaPhim: movie.MaPhim, MaPhong: room.MaPhong, MaLoaiNgay: dayType.MaLoaiNgay, NgayChieu: showtimeStart, GioChieu: showtimeStart, GiaVeGoc: 50000 },
    });
    const seat = await prisma.ghe.create({ data: { ViTriDay: 'A', ViTriCot: 1, MaPhong: room.MaPhong, MaLoaiGhe: seatType.MaLoaiGhe } });
    const showtimeSeat = await prisma.gheSuatChieu.create({
      data: { MaSuatChieu: showtime.MaSuatChieu, MaGhe: seat.MaGhe, TrangThai: 'TRONG', GiaVe: 70000 },
    });
    showtimeId = showtime.MaSuatChieu;
    seatId = showtimeSeat.MaGheSuatChieu;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it('creates a paid guest booking for an Admin cash sale', async () => {
    const response = await request(app)
      .post('/api/v1/admin/ban-ve-tai-quay')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        MaSuatChieu: showtimeId,
        DanhSachMaGheSuatChieu: [seatId],
        PhuongThucThanhToan: 'TIEN_MAT',
        TenKhachHang: 'Khach vang lai',
        SoDienThoai: '0900000000',
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      TongTien: 70000,
      TrangThai: 'DA_THANH_TOAN',
      PhuongThucThanhToan: 'TIEN_MAT',
    });
    expect(response.body.data.QRPayload).toBe(`QR_${response.body.data.MaPhieuDat}`);

    const bookings = await prisma.$queryRaw<Array<{ MaKhachHang: string | null; KenhDat: string; TenKhachHangTaiQuay: string }>>`
      SELECT MaKhachHang, KenhDat, TenKhachHangTaiQuay
      FROM phieu_dat_ve
      WHERE MaPhieuDat = ${response.body.data.MaPhieuDat}
    `;
    expect(bookings[0]).toMatchObject({ MaKhachHang: null, KenhDat: 'TAI_QUAY', TenKhachHangTaiQuay: 'Khach vang lai' });

    const searchResponse = await request(app)
      .get('/api/v1/admin/giao-dich/phieu-dat?search=Khach%20vang%20lai')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.pagination.total).toBe(1);
  });

  it('allows only Admin accounts to create a counter sale', async () => {
    const response = await request(app)
      .post('/api/v1/admin/ban-ve-tai-quay')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ MaSuatChieu: showtimeId, DanhSachMaGheSuatChieu: [seatId], PhuongThucThanhToan: 'TIEN_MAT' });

    expect(response.status).toBe(403);
  });

  it('does not sell the same seat twice', async () => {
    const response = await request(app)
      .post('/api/v1/admin/ban-ve-tai-quay')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ MaSuatChieu: showtimeId, DanhSachMaGheSuatChieu: [seatId], PhuongThucThanhToan: 'TIEN_MAT' });

    expect(response.status).toBe(400);
  });
});
