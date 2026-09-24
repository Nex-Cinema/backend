import { SuatChieu, Prisma } from '@prisma/client';
import prisma from '../../../config/prisma';
import {
  findSuatChieus,
  findSuatChieuById,
  findOverlappingShowtimes,
  countSoldTickets,
  findGheSuatChieusByShowtime,
  findShowtimeForSeatMap,
} from './suatchieu.repository';
import { releaseExpiredHolds } from './ghesuatchieu.repository';
import { CreateSuatChieuInput, UpdateSuatChieuInput } from './suatchieu.validator';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import { combineShowtimeDateTime } from '../../../utils/showtimeDateTime';
import { calculateSeatPrice, formatSeatLabel } from '../../../utils/seatPricing';

/**
 * Helper to combine NgayChieu (Date part) and GioChieu (Time part) in UTC
 */
export const getCombinedDateTime = combineShowtimeDateTime;

/**
 * Check if a showtime conflicts with other showtimes in the same room
 */
export const checkConflict = async (
  maPhong: string,
  ngayChieu: Date,
  gioChieu: Date,
  thoiLuongPhim: number,
  excludeMaSuatChieu?: string,
): Promise<void> => {
  const newStart = getCombinedDateTime(ngayChieu, gioChieu);
  const newEnd = new Date(newStart.getTime() + thoiLuongPhim * 60 * 1000);

  const existingShowtimes = await findOverlappingShowtimes(maPhong, ngayChieu, excludeMaSuatChieu);

  for (const esc of existingShowtimes) {
    const escStart = getCombinedDateTime(esc.NgayChieu, esc.GioChieu);
    const escEnd = new Date(escStart.getTime() + esc.Phim.ThoiLuong * 60 * 1000);

    if (newStart < escEnd && newEnd > escStart) {
      throw new BadRequestError(
        `Thời gian chiếu bị trùng lịch với suất chiếu khác trong phòng này (phim đang chiếu: ${esc.Phim.TenPhim} từ ${escStart.toISOString()} đến ${escEnd.toISOString()})`,
      );
    }
  }
};

/**
 * Retrieve all showtimes with filters
 */
export const getSuatChieus = async (filters: {
  maPhim?: string;
  maPhong?: string;
  ngayChieu?: Date;
  khaDung?: boolean;
}): Promise<any[]> => {
  return findSuatChieus(filters);
};

/**
 * Get showtime details by ID
 */
export const getSuatChieuById = async (maSuatChieu: string): Promise<any> => {
  const sc = await findSuatChieuById(maSuatChieu);
  if (!sc) {
    throw new NotFoundError('Không tìm thấy suất chiếu');
  }
  return sc;
};

/**
 * Create a new showtime and auto-generate seat layout with dynamic pricing
 */
export const createSuatChieuService = async (input: CreateSuatChieuInput): Promise<SuatChieu> => {
  // 1. Assert Phim exists and is active
  const phim = await prisma.phim.findUnique({
    where: { MaPhim: input.MaPhim },
  });
  if (!phim || !phim.KhaDung) {
    throw new NotFoundError('Không tìm thấy phim hoạt động');
  }

  // 2. Assert PhongChieu exists and is active
  const phong = await prisma.phongChieu.findUnique({
    where: { MaPhong: input.MaPhong },
    include: { LoaiPhong: true },
  });
  if (!phong || !phong.KhaDung) {
    throw new NotFoundError('Không tìm thấy phòng chiếu hoạt động');
  }

  // 3. Assert LoaiNgay exists and is active
  const loaiNgay = await prisma.loaiNgay.findUnique({
    where: { MaLoaiNgay: input.MaLoaiNgay },
  });
  if (!loaiNgay || !loaiNgay.KhaDung) {
    throw new NotFoundError('Không tìm thấy loại ngày hoạt động');
  }

  // 4. Assert time is not in the past
  const startDateTime = getCombinedDateTime(input.NgayChieu, input.GioChieu);
  if (startDateTime < new Date()) {
    throw new BadRequestError('Không thể lên lịch chiếu cho thời gian trong quá khứ');
  }

  // 5. Check conflict
  await checkConflict(input.MaPhong, input.NgayChieu, input.GioChieu, phim.ThoiLuong);

  // 6. Create showtime and generate GheSuatChieu in transaction
  return prisma.$transaction(async (tx) => {
    const newSc = await tx.suatChieu.create({
      data: {
        MaPhim: input.MaPhim,
        MaPhong: input.MaPhong,
        MaLoaiNgay: input.MaLoaiNgay,
        NgayChieu: input.NgayChieu,
        GioChieu: input.GioChieu,
        GiaVeGoc: input.GiaVeGoc,
        KhaDung: input.KhaDung ?? true,
      },
    });

    // Query active seats in the room
    const activeSeats = await tx.ghe.findMany({
      where: {
        MaPhong: input.MaPhong,
        KhaDung: true,
      },
      include: {
        LoaiGhe: true,
      },
    });

    const basePrice = Number(input.GiaVeGoc);
    const phuThuPhong = Number(phong.LoaiPhong.PhuThu);
    const phuThuNgay = Number(loaiNgay.PhuThu);

    const gheSuatChieuData = activeSeats.map((seat) => {
      const phuThuGhe = Number(seat.LoaiGhe.PhuThu);
      const ticketPrice = calculateSeatPrice(basePrice, phuThuPhong, phuThuNgay, phuThuGhe, seat.SucChua);

      return {
        MaSuatChieu: newSc.MaSuatChieu,
        MaGhe: seat.MaGhe,
        TrangThai: 'TRONG' as any, // Default to TRONG
        GiaVe: ticketPrice,
        KhaDung: true,
      };
    });

    if (gheSuatChieuData.length > 0) {
      await tx.gheSuatChieu.createMany({
        data: gheSuatChieuData,
      });
    }

    return newSc;
  });
};

/**
 * Update an existing showtime and handle updates to seat config or pricing
 */
export const updateSuatChieuService = async (
  maSuatChieu: string,
  input: UpdateSuatChieuInput,
): Promise<SuatChieu> => {
  // 1. Assert showtime exists
  const existingSc = await prisma.suatChieu.findUnique({
    where: { MaSuatChieu: maSuatChieu },
    include: {
      Phim: true,
      PhongChieu: { include: { LoaiPhong: true } },
      LoaiNgay: true,
    },
  });
  if (!existingSc) {
    throw new NotFoundError('Không tìm thấy suất chiếu');
  }

  // 2. Check if tickets have been sold
  const soldTicketsCount = await countSoldTickets(maSuatChieu);
  const affectsSeatsOrPrice =
    (input.MaPhong && input.MaPhong !== existingSc.MaPhong) ||
    (input.MaPhim && input.MaPhim !== existingSc.MaPhim) ||
    (input.GiaVeGoc !== undefined && Number(input.GiaVeGoc) !== Number(existingSc.GiaVeGoc)) ||
    (input.MaLoaiNgay && input.MaLoaiNgay !== existingSc.MaLoaiNgay);

  if (soldTicketsCount > 0 && affectsSeatsOrPrice) {
    throw new BadRequestError('Không thể sửa đổi phim, phòng chiếu, giá vé hoặc loại ngày của suất chiếu đã bán vé');
  }

  // 3. Assert new entities if provided
  let phim = existingSc.Phim;
  if (input.MaPhim && input.MaPhim !== existingSc.MaPhim) {
    const p = await prisma.phim.findUnique({ where: { MaPhim: input.MaPhim } });
    if (!p || !p.KhaDung) throw new NotFoundError('Không tìm thấy phim hoạt động');
    phim = p;
  }

  let phong = existingSc.PhongChieu;
  if (input.MaPhong && input.MaPhong !== existingSc.MaPhong) {
    const pr = await prisma.phongChieu.findUnique({
      where: { MaPhong: input.MaPhong },
      include: { LoaiPhong: true },
    });
    if (!pr || !pr.KhaDung) throw new NotFoundError('Không tìm thấy phòng chiếu hoạt động');
    phong = pr;
  }

  let loaiNgay = existingSc.LoaiNgay;
  if (input.MaLoaiNgay && input.MaLoaiNgay !== existingSc.MaLoaiNgay) {
    const ln = await prisma.loaiNgay.findUnique({ where: { MaLoaiNgay: input.MaLoaiNgay } });
    if (!ln || !ln.KhaDung) throw new NotFoundError('Không tìm thấy loại ngày hoạt động');
    loaiNgay = ln;
  }

  // 4. Validate date/time conflict
  const newNgay = input.NgayChieu ?? existingSc.NgayChieu;
  const newGio = input.GioChieu ?? existingSc.GioChieu;
  const newRoomId = input.MaPhong ?? existingSc.MaPhong;

  if (input.NgayChieu || input.GioChieu) {
    const startDateTime = getCombinedDateTime(newNgay, newGio);
    if (startDateTime < new Date()) {
      throw new BadRequestError('Không thể lên lịch chiếu cho thời gian trong quá khứ');
    }
  }

  if (input.NgayChieu || input.GioChieu || input.MaPhong || input.MaPhim) {
    await checkConflict(newRoomId, newNgay, newGio, phim.ThoiLuong, maSuatChieu);
  }

  // 5. Perform update and adjust seats in transaction
  return prisma.$transaction(async (tx) => {
    const updatedSc = await tx.suatChieu.update({
      where: { MaSuatChieu: maSuatChieu },
      data: {
        MaPhim: input.MaPhim,
        MaPhong: input.MaPhong,
        MaLoaiNgay: input.MaLoaiNgay,
        NgayChieu: input.NgayChieu,
        GioChieu: input.GioChieu,
        GiaVeGoc: input.GiaVeGoc,
        KhaDung: input.KhaDung,
      },
    });

    // If room changed, delete old seats and regenerate
    if (input.MaPhong && input.MaPhong !== existingSc.MaPhong) {
      await tx.gheSuatChieu.deleteMany({
        where: { MaSuatChieu: maSuatChieu },
      });

      const activeSeats = await tx.ghe.findMany({
        where: { MaPhong: input.MaPhong, KhaDung: true },
        include: { LoaiGhe: true },
      });

      const basePrice = Number(updatedSc.GiaVeGoc);
      const phuThuPhong = Number(phong.LoaiPhong.PhuThu);
      const phuThuNgay = Number(loaiNgay.PhuThu);

      const gheSuatChieuData = activeSeats.map((seat) => {
        const phuThuGhe = Number(seat.LoaiGhe.PhuThu);
        const ticketPrice = calculateSeatPrice(basePrice, phuThuPhong, phuThuNgay, phuThuGhe, seat.SucChua);

        return {
          MaSuatChieu: maSuatChieu,
          MaGhe: seat.MaGhe,
          TrangThai: 'TRONG' as any,
          GiaVe: ticketPrice,
          KhaDung: true,
        };
      });

      if (gheSuatChieuData.length > 0) {
        await tx.gheSuatChieu.createMany({ data: gheSuatChieuData });
      }
    }
    // If base price or day type changed but room did not change, recalculate prices
    else if (
      (input.GiaVeGoc !== undefined && Number(input.GiaVeGoc) !== Number(existingSc.GiaVeGoc)) ||
      (input.MaLoaiNgay && input.MaLoaiNgay !== existingSc.MaLoaiNgay)
    ) {
      const seats = await tx.gheSuatChieu.findMany({
        where: { MaSuatChieu: maSuatChieu },
        include: {
          Ghe: {
            include: {
              LoaiGhe: true,
            },
          },
        },
      });

      const basePrice = Number(updatedSc.GiaVeGoc);
      const phuThuPhong = Number(phong.LoaiPhong.PhuThu);
      const phuThuNgay = Number(loaiNgay.PhuThu);

      for (const seat of seats) {
        const phuThuGhe = Number(seat.Ghe.LoaiGhe.PhuThu);
        const newPrice = calculateSeatPrice(basePrice, phuThuPhong, phuThuNgay, phuThuGhe, seat.Ghe.SucChua);

        await tx.gheSuatChieu.update({
          where: { MaGheSuatChieu: seat.MaGheSuatChieu },
          data: { GiaVe: newPrice },
        });
      }
    }

    return updatedSc;
  });
};

/**
 * Delete a showtime
 */
export const deleteSuatChieuService = async (maSuatChieu: string): Promise<SuatChieu> => {
  const existingSc = await prisma.suatChieu.findUnique({
    where: { MaSuatChieu: maSuatChieu },
  });
  if (!existingSc) {
    throw new NotFoundError('Không tìm thấy suất chiếu');
  }

  const soldTicketsCount = await countSoldTickets(maSuatChieu);
  if (soldTicketsCount > 0) {
    throw new BadRequestError('Không thể xóa suất chiếu đã bán vé');
  }

  return prisma.$transaction(async (tx) => {
    await tx.gheSuatChieu.deleteMany({
      where: { MaSuatChieu: maSuatChieu },
    });
    return tx.suatChieu.delete({
      where: { MaSuatChieu: maSuatChieu },
    });
  });
};

/**
 * Retrieve the current seat layout of a showtime
 */
export const getSeatsOfShowtimeService = async (maSuatChieu: string): Promise<any[]> => {
  // Verify showtime exists
  const existingSc = await prisma.suatChieu.findUnique({
    where: { MaSuatChieu: maSuatChieu },
  });
  if (!existingSc) {
    throw new NotFoundError('Không tìm thấy suất chiếu');
  }

  return findGheSuatChieusByShowtime(maSuatChieu);
};

/**
 * Service to get seat map and seat statuses for a showtime
 */
export const getSeatMap = async (maSuatChieu: string) => {
  const now = new Date();

  // 1. Release expired holds for this showtime first
  await releaseExpiredHolds(now, maSuatChieu);

  // 2. Fetch showtime with all related entities
  const sc = await findShowtimeForSeatMap(maSuatChieu);
  if (!sc) {
    throw new NotFoundError(`Không tìm thấy suất chiếu với mã: ${maSuatChieu}`);
  }

  // 3. Format/Calculate showtime times
  let gioKetThuc = (sc as any).GioKetThuc;
  if (!gioKetThuc) {
    gioKetThuc = new Date(sc.GioChieu);
    gioKetThuc.setMinutes(gioKetThuc.getMinutes() + sc.Phim.ThoiLuong);
  } else {
    gioKetThuc = new Date(gioKetThuc);
  }

  const basePrice = Number(sc.GiaVeGoc);
  const roomSurcharge = Number(sc.PhongChieu.LoaiPhong.PhuThu);
  const daySurcharge = Number(sc.LoaiNgay.PhuThu);

  // 4. Map Ghes list
  const ghes = sc.GheSuatChieus.map((gsc) => {
    const seatSurcharge = Number(gsc.Ghe.LoaiGhe.PhuThu);
    const calculatedPrice = calculateSeatPrice(basePrice, roomSurcharge, daySurcharge, seatSurcharge, gsc.Ghe.SucChua);

    // Check if the hold is expired in-memory (redundancy fallback)
    const isExpired = gsc.TrangThai === 'DANG_GIU' && gsc.ThoiGianGiuGhe && new Date(gsc.ThoiGianGiuGhe) < now;
    const finalStatus = isExpired ? 'TRONG' : gsc.TrangThai;
    const finalExpiry = isExpired ? null : gsc.ThoiGianGiuGhe;

    return {
      MaGheSuatChieu: gsc.MaGheSuatChieu,
      MaGhe: gsc.MaGhe,
      TenGhe: formatSeatLabel(gsc.Ghe.ViTriDay, gsc.Ghe.ViTriCot, gsc.Ghe.DoRongCot),
      LoaiGhe: gsc.Ghe.MaLoaiGhe,
      SoThuTu: gsc.Ghe.ViTriCot,
      DoRongCot: gsc.Ghe.DoRongCot,
      SucChua: gsc.Ghe.SucChua,
      TenLoaiGhe: gsc.Ghe.LoaiGhe.TenLoaiGhe,
      GiaPhuThuLoaiGhe: seatSurcharge,
      TrangThai: finalStatus,
      ThoiGianGiuGhe: finalExpiry,
      GiaVeTinhToan: calculatedPrice,
    };
  });

  return {
    SuatChieu: {
      MaSuatChieu: sc.MaSuatChieu,
      NgayChieu: sc.NgayChieu,
      GioChieu: sc.GioChieu,
      GioKetThuc: gioKetThuc,
      GiaVeGoc: basePrice,
    },
    Phim: {
      MaPhim: sc.Phim.MaPhim,
      TenPhim: sc.Phim.TenPhim,
      ThoiLuong: sc.Phim.ThoiLuong,
      GioiHanTuoi: sc.Phim.GioiHanTuoi,
    },
    PhongChieu: {
      MaPhongChieu: sc.PhongChieu.MaPhong,
      TenPhong: sc.PhongChieu.TenPhong,
    },
    LoaiPhong: {
      MaLoaiPhong: sc.PhongChieu.LoaiPhong.MaLoaiPhong,
      TenLoaiPhong: sc.PhongChieu.LoaiPhong.TenLoaiPhong,
      GiaPhuThu: roomSurcharge,
    },
    SoDoGhe: {
      MaSoDoGhe: sc.PhongChieu.SoDoGhe.MaSoDo,
      TongHang: sc.PhongChieu.SoDoGhe.SoHang,
      TongCot: sc.PhongChieu.SoDoGhe.SoCot,
      CauTruc: sc.PhongChieu.SoDoGhe.CauTruc,
    },
    Ghe: ghes,
  };
};
