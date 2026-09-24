import {
  GioiHanTuoi,
  Prisma,
  Role,
  TrangThaiGheSuatChieu,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';
import { calculateSeatPrice } from '../utils/seatPricing';

const DEMO_MOVIE_NAME = 'Nex Cinema E2E Demo';
const DEMO_ROOM_NAME = 'Phòng Demo E2E · Couple 5x6';
const DEMO_SEAT_MAP_NAME = 'Sơ đồ Demo E2E 5x6';
const DEMO_USERNAME = 'e2e_customer';
const DEMO_PASSWORD = '123456';

const bangkokCalendarDate = (offsetInDays = 0): Date => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(
    Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)),
  );
  date.setUTCDate(date.getUTCDate() + offsetInDays);
  return date;
};

const showtimeClock = (hour: number, minute = 0): Date =>
  new Date(Date.UTC(1970, 0, 1, hour, minute, 0));

const ensureDemoCustomer = async (tx: Prisma.TransactionClient): Promise<void> => {
  const existing = await tx.taiKhoan.findUnique({
    where: { TenDangNhap: DEMO_USERNAME },
  });

  if (existing) return;

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
  await tx.taiKhoan.create({
    data: {
      TenDangNhap: DEMO_USERNAME,
      MatKhau: hashedPassword,
      HoTen: 'Khách hàng E2E',
      Email: 'e2e.customer@nexcinema.test',
      SoDienThoai: '0999999999',
      GioiTinh: true,
      NgaySinh: new Date('2000-01-01'),
      VaiTro: Role.CUSTOMER,
      KhaDung: true,
      KhachHang: { create: { KhaDung: true } },
    },
  });
};

/**
 * Keeps a small, rolling set of demo data available for local end-to-end tests.
 * It is intentionally additive and never resets bookings or paid seats.
 */
export const ensureDemoBookingData = async (): Promise<void> => {
  await prisma.$transaction(
    async (tx) => {
      await tx.cauHinhCongThanhToan.upsert({
        where: { NhaCungCap: 'VNPAY' },
        update: {},
        create: { NhaCungCap: 'VNPAY', KichHoat: true },
      });

      await ensureDemoCustomer(tx);

      let roomType = await tx.loaiPhong.findFirst({
        where: { TenLoaiPhong: '2D Standard' },
      });
      roomType ??= await tx.loaiPhong.create({
        data: { TenLoaiPhong: '2D Standard', PhuThu: 0, KhaDung: true },
      });

      let seatMap = await tx.soDoGhe.findFirst({
        where: { TenSoDo: DEMO_SEAT_MAP_NAME },
      });
      seatMap ??= await tx.soDoGhe.create({
        data: {
          TenSoDo: DEMO_SEAT_MAP_NAME,
          SoHang: 5,
          SoCot: 6,
          CauTruc: JSON.stringify({
            aisles: { rows: [], cols: [], custom: [] },
            couples: [
              { row: 5, startCol: 1 },
              { row: 5, startCol: 3 },
              { row: 5, startCol: 5 },
            ],
          }),
          KhaDung: true,
        },
      });

      let room = await tx.phongChieu.findFirst({
        where: { TenPhong: DEMO_ROOM_NAME },
      });
      if (!room) {
        room = await tx.phongChieu.create({
          data: {
            TenPhong: DEMO_ROOM_NAME,
            MaLoaiPhong: roomType.MaLoaiPhong,
            MaSoDo: seatMap.MaSoDo,
            KhaDung: true,
          },
        });
      } else if (!room.KhaDung) {
        room = await tx.phongChieu.update({
          where: { MaPhong: room.MaPhong },
          data: { KhaDung: true },
        });
      }

      let standardSeatType = await tx.loaiGhe.findFirst({
        where: { TenLoaiGhe: 'Thường' },
      });
      standardSeatType ??= await tx.loaiGhe.create({
        data: { TenLoaiGhe: 'Thường', PhuThu: 0, KhaDung: true },
      });

      let vipSeatType = await tx.loaiGhe.findFirst({
        where: { TenLoaiGhe: 'VIP' },
      });
      vipSeatType ??= await tx.loaiGhe.create({
        data: { TenLoaiGhe: 'VIP', PhuThu: 15000, KhaDung: true },
      });

      let coupleSeatType = await tx.loaiGhe.findFirst({
        where: { TenLoaiGhe: 'Sweetbox' },
      });
      coupleSeatType ??= await tx.loaiGhe.create({
        data: { TenLoaiGhe: 'Sweetbox', PhuThu: 30000, KhaDung: true },
      });

      const existingSeats = await tx.ghe.findMany({
        where: { MaPhong: room.MaPhong },
      });
      const existingSeatPositions = new Set(
        existingSeats.map((seat) => `${seat.ViTriDay}-${seat.ViTriCot}`),
      );
      const seatsToCreate: Prisma.GheCreateManyInput[] = [];

      for (const row of ['A', 'B', 'C', 'D', 'E']) {
        const columns = row === 'E' ? [1, 3, 5] : [1, 2, 3, 4, 5, 6];
        for (const column of columns) {
          if (!existingSeatPositions.has(`${row}-${column}`)) {
            seatsToCreate.push({
              ViTriDay: row,
              ViTriCot: column,
              DoRongCot: row === 'E' ? 2 : 1,
              SucChua: row === 'E' ? 2 : 1,
              MaPhong: room.MaPhong,
              MaLoaiGhe:
                row === 'E'
                  ? coupleSeatType.MaLoaiGhe
                  : row === 'C' || row === 'D'
                  ? vipSeatType.MaLoaiGhe
                  : standardSeatType.MaLoaiGhe,
              KhaDung: true,
            });
          }
        }
      }

      if (seatsToCreate.length > 0) {
        await tx.ghe.createMany({ data: seatsToCreate });
      }

      let dayType = await tx.loaiNgay.findFirst({
        where: { TenLoaiNgay: 'Ngày thường' },
      });
      dayType ??= await tx.loaiNgay.create({
        data: { TenLoaiNgay: 'Ngày thường', PhuThu: 0, KhaDung: true },
      });

      let movie = await tx.phim.findFirst({
        where: { TenPhim: DEMO_MOVIE_NAME },
      });
      const movieWindow = {
        NgayKhoiChieu: bangkokCalendarDate(-7),
        NgayKetThuc: bangkokCalendarDate(30),
        KhaDung: true,
      };

      if (!movie) {
        movie = await tx.phim.create({
          data: {
            TenPhim: DEMO_MOVIE_NAME,
            ThoiLuong: 120,
            TheLoai: 'Hành động, Phiêu lưu',
            ...movieWindow,
            DaoDien: 'Nex Cinema',
            DienVien: 'Demo Cast',
            GioiHanTuoi: GioiHanTuoi.P,
            NoiDung: 'Phim demo luôn khả dụng để kiểm thử toàn bộ luồng đặt vé.',
            Trailer: 'https://www.youtube.com/watch?v=TcMBFSGVi1c',
            HinhAnh: null,
          },
        });
      } else {
        movie = await tx.phim.update({
          where: { MaPhim: movie.MaPhim },
          data: movieWindow,
        });
      }

      const seats = await tx.ghe.findMany({
        where: { MaPhong: room.MaPhong, KhaDung: true },
        include: { LoaiGhe: true },
      });

      // Tomorrow and the following two days are always in the future, regardless
      // of what time the backend starts. Two sessions per day provide 150 seats.
      const rollingShowtimes = [
        { dayOffset: 1, hour: 10, minute: 0 },
        { dayOffset: 1, hour: 19, minute: 0 },
        { dayOffset: 2, hour: 10, minute: 0 },
        { dayOffset: 2, hour: 19, minute: 0 },
        { dayOffset: 3, hour: 10, minute: 0 },
        { dayOffset: 3, hour: 19, minute: 0 },
      ];

      const existingRollingShowtimes = await tx.suatChieu.findMany({
        where: {
          MaPhim: movie.MaPhim,
          MaPhong: room.MaPhong,
          NgayChieu: {
            gte: bangkokCalendarDate(1),
            lte: bangkokCalendarDate(3),
          },
        },
      });

      for (const slot of rollingShowtimes) {
        const date = bangkokCalendarDate(slot.dayOffset);
        const time = showtimeClock(slot.hour, slot.minute);
        let showtime = existingRollingShowtimes.find(
          (item) =>
            item.NgayChieu.toISOString() === date.toISOString()
            && item.GioChieu.toISOString() === time.toISOString(),
        );

        if (!showtime) {
          showtime = await tx.suatChieu.create({
            data: {
              MaPhim: movie.MaPhim,
              MaPhong: room.MaPhong,
              MaLoaiNgay: dayType.MaLoaiNgay,
              NgayChieu: date,
              GioChieu: time,
              GiaVeGoc: 70000,
              KhaDung: true,
            },
          });
          existingRollingShowtimes.push(showtime);
        } else if (!showtime.KhaDung) {
          showtime = await tx.suatChieu.update({
            where: { MaSuatChieu: showtime.MaSuatChieu },
            data: { KhaDung: true },
          });
        }

        const showtimeSeats = await tx.gheSuatChieu.findMany({
          where: { MaSuatChieu: showtime.MaSuatChieu },
          select: { MaGhe: true },
        });
        const attachedSeatIds = new Set(showtimeSeats.map((seat) => seat.MaGhe));
        const missingShowtimeSeats = seats
          .filter((seat) => !attachedSeatIds.has(seat.MaGhe))
          .map((seat) => ({
            MaSuatChieu: showtime.MaSuatChieu,
            MaGhe: seat.MaGhe,
            TrangThai: TrangThaiGheSuatChieu.TRONG,
            GiaVe: calculateSeatPrice(
              70000,
              Number(roomType.PhuThu),
              Number(dayType.PhuThu),
              Number(seat.LoaiGhe.PhuThu),
              seat.SucChua,
            ),
            KhaDung: true,
          }));

        if (missingShowtimeSeats.length > 0) {
          await tx.gheSuatChieu.createMany({ data: missingShowtimeSeats });
        }
      }
    },
    { maxWait: 10_000, timeout: 30_000 },
  );

  console.log(
    `🌱 Demo E2E sẵn sàng: phim "${DEMO_MOVIE_NAME}", 6 suất chiếu tương lai, tài khoản ${DEMO_USERNAME}/${DEMO_PASSWORD}`,
  );
};
