import { Role, GioiHanTuoi } from '@prisma/client';
import prisma from '../config/prisma';
import {
  findStaffByAccountId,
  findAvailableShowtimesForStaff,
  findStaffSeatMap,
  releaseExpiredHolds,
  sellTicketsAtCounterTransaction,
  ShowtimeFilters,
} from '../repositories/staffBanVe.repository';
import { UnauthorizedError, NotFoundError, BadRequestError } from '../utils/errors';
import { StaffSellTicketInput } from '../validators/staffBanVe.validator';
import { calculateSeatPrice, formatSeatLabel } from '../utils/seatPricing';

export interface StaffShowtimeResponse {
  MaSuatChieu: string;
  NgayChieu: Date;
  GioChieu: Date;
  GiaVeGoc: number;
  Phim: {
    MaPhim: string;
    TenPhim: string;
    ThoiLuong: number;
    GioiHanTuoi: GioiHanTuoi;
  };
  PhongChieu: {
    MaPhong: string;
    TenPhong: string;
  };
  LoaiPhong: {
    MaLoaiPhong: string;
    TenLoaiPhong: string;
    PhuThu: number;
  };
  LoaiNgay: {
    MaLoaiNgay: string;
    TenLoaiNgay: string;
    PhuThu: number;
  };
  soGheTrong: number;
  soGheDaDat: number;
  soGheDangGiu: number;
}

export interface PaginatedShowtimes {
  showtimes: StaffShowtimeResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Get showtimes for counter ticket selling (Staff view)
 */
export const getShowtimesForStaff = async (
  maTaiKhoan: string,
  queryFilters: ShowtimeFilters & { page: number; limit: number },
): Promise<PaginatedShowtimes> => {
  // 1. Verify active staff account
  const staff = await findStaffByAccountId(maTaiKhoan);
  if (!staff) {
    throw new UnauthorizedError('Tài khoản đã bị vô hiệu hóa hoặc không có quyền nhân viên');
  }

  // 2. Fetch showtimes from today onwards
  const showtimes = await findAvailableShowtimesForStaff({
    keyword: queryFilters.keyword,
    ngayChieu: queryFilters.ngayChieu,
    maPhim: queryFilters.maPhim,
    maPhong: queryFilters.maPhong,
  });

  const now = new Date();

  // 3. Filter out started showtimes and map counts in-memory
  const mappedShowtimes = showtimes
    .map((sc) => {
      // Combine date and time
      const showtimeStart = new Date(sc.NgayChieu);
      const gioChieu = new Date(sc.GioChieu);
      showtimeStart.setHours(gioChieu.getHours(), gioChieu.getMinutes(), gioChieu.getSeconds());

      // Return null if showtime has already started
      if (showtimeStart <= now) {
        return null;
      }

      // Calculate seat counts
      let soGheTrong = 0;
      let soGheDaDat = 0;
      let soGheDangGiu = 0;

      for (const gsc of sc.GheSuatChieus) {
        if (gsc.TrangThai === 'DA_DAT') {
          soGheDaDat++;
        } else if (gsc.TrangThai === 'DANG_GIU') {
          const isExpired = gsc.ThoiGianGiuGhe && new Date(gsc.ThoiGianGiuGhe) < now;
          if (isExpired) {
            soGheTrong++;
          } else {
            soGheDangGiu++;
          }
        } else {
          soGheTrong++;
        }
      }

      return {
        MaSuatChieu: sc.MaSuatChieu,
        NgayChieu: sc.NgayChieu,
        GioChieu: sc.GioChieu,
        GiaVeGoc: Number(sc.GiaVeGoc),
        Phim: {
          MaPhim: sc.Phim.MaPhim,
          TenPhim: sc.Phim.TenPhim,
          ThoiLuong: sc.Phim.ThoiLuong,
          GioiHanTuoi: sc.Phim.GioiHanTuoi,
        },
        PhongChieu: {
          MaPhong: sc.PhongChieu.MaPhong,
          TenPhong: sc.PhongChieu.TenPhong,
        },
        LoaiPhong: {
          MaLoaiPhong: sc.PhongChieu.LoaiPhong.MaLoaiPhong,
          TenLoaiPhong: sc.PhongChieu.LoaiPhong.TenLoaiPhong,
          PhuThu: Number(sc.PhongChieu.LoaiPhong.PhuThu),
        },
        LoaiNgay: {
          MaLoaiNgay: sc.LoaiNgay.MaLoaiNgay,
          TenLoaiNgay: sc.LoaiNgay.TenLoaiNgay,
          PhuThu: Number(sc.LoaiNgay.PhuThu),
        },
        soGheTrong,
        soGheDaDat,
        soGheDangGiu,
      };
    })
    .filter((sc): sc is StaffShowtimeResponse => sc !== null);

  // 4. Apply pagination in memory
  const total = mappedShowtimes.length;
  const page = queryFilters.page;
  const limit = queryFilters.limit;
  const totalPages = Math.ceil(total / limit) || 1;
  const skip = (page - 1) * limit;

  const paginatedShowtimes = mappedShowtimes.slice(skip, skip + limit);

  return {
    showtimes: paginatedShowtimes,
    total,
    page,
    limit,
    totalPages,
  };
};

/**
 * Get seat map and seat statuses for a showtime (Staff view)
 */
export const getSeatMapForStaff = async (
  maTaiKhoan: string,
  maSuatChieu: string,
) => {
  // 1. Verify active staff account
  const staff = await findStaffByAccountId(maTaiKhoan);
  if (!staff) {
    throw new UnauthorizedError('Tài khoản đã bị vô hiệu hóa hoặc không có quyền nhân viên');
  }

  const now = new Date();

  // 2. Release expired holds for this showtime first
  await releaseExpiredHolds(now, maSuatChieu);

  // 3. Fetch showtime with its seat map
  const sc = await findStaffSeatMap(maSuatChieu);
  if (!sc) {
    throw new NotFoundError(`Không tìm thấy suất chiếu với mã: ${maSuatChieu}`);
  }

  // Calculate ending time
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

  // Map seats
  const seats = sc.GheSuatChieus.map((gsc) => {
    const seatSurcharge = Number(gsc.Ghe.LoaiGhe.PhuThu);
    const calculatedPrice = calculateSeatPrice(basePrice, roomSurcharge, daySurcharge, seatSurcharge, gsc.Ghe.SucChua);

    // Check if hold is expired in-memory (redundancy check)
    const isExpired = gsc.TrangThai === 'DANG_GIU' && gsc.ThoiGianGiuGhe && new Date(gsc.ThoiGianGiuGhe) < now;
    const finalStatus = isExpired ? 'TRONG' : gsc.TrangThai;

    return {
      MaGheSuatChieu: gsc.MaGheSuatChieu,
      MaGhe: gsc.MaGhe,
      TenGhe: formatSeatLabel(gsc.Ghe.ViTriDay, gsc.Ghe.ViTriCot, gsc.Ghe.DoRongCot),
      LoaiGhe: gsc.Ghe.MaLoaiGhe,
      SoThuTu: gsc.Ghe.ViTriCot,
      TenLoaiGhe: gsc.Ghe.LoaiGhe.TenLoaiGhe,
      GiaPhuThuLoaiGhe: seatSurcharge,
      DoRongCot: gsc.Ghe.DoRongCot,
      SucChua: gsc.Ghe.SucChua,
      TrangThai: finalStatus,
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
      CauTruc: null,
    },
    Ghe: seats,
  };
};

/**
 * Sell tickets at counter (POS check-out)
 */
export const sellTicketsAtCounter = async (
  maTaiKhoan: string,
  body: StaffSellTicketInput,
) => {
  // 1. Verify active staff account
  const staff = await findStaffByAccountId(maTaiKhoan);
  if (!staff) {
    throw new UnauthorizedError('Tài khoản đã bị vô hiệu hóa hoặc không có quyền nhân viên');
  }

  const now = new Date();

  // 2. Fetch showtime to validate existence, start time, and active status
  const sc = await prisma.suatChieu.findFirst({
    where: {
      MaSuatChieu: body.MaSuatChieu,
      KhaDung: true,
    },
    include: {
      Phim: true,
      PhongChieu: {
        include: {
          LoaiPhong: true,
        },
      },
      LoaiNgay: true,
    },
  });

  if (!sc) {
    throw new NotFoundError(`Không tìm thấy suất chiếu với mã: ${body.MaSuatChieu}`);
  }

  // Combine NgayChieu and GioChieu
  const showtimeStart = new Date(sc.NgayChieu);
  const gioChieu = new Date(sc.GioChieu);
  showtimeStart.setHours(gioChieu.getHours(), gioChieu.getMinutes(), gioChieu.getSeconds());

  if (showtimeStart <= now) {
    throw new BadRequestError('Suất chiếu đã bắt đầu hoặc đã diễn ra, không thể bán vé.');
  }

  // 3. Fetch and validate selected seats
  const seats = await prisma.gheSuatChieu.findMany({
    where: {
      MaGheSuatChieu: { in: body.DanhSachMaGheSuatChieu },
      MaSuatChieu: body.MaSuatChieu,
      KhaDung: true,
    },
    include: {
      Ghe: {
        include: {
          LoaiGhe: true,
        },
      },
    },
  });

  if (seats.length !== body.DanhSachMaGheSuatChieu.length) {
    throw new BadRequestError('Một hoặc nhiều ghế được chọn không tồn tại hoặc không hợp lệ.');
  }

  // 4. Calculate prices
  const basePrice = Number(sc.GiaVeGoc);
  const roomSurcharge = Number(sc.PhongChieu.LoaiPhong.PhuThu);
  const daySurcharge = Number(sc.LoaiNgay.PhuThu);

  let totalAmount = 0;
  const calculatedPrices = seats.map((s) => {
    const seatSurcharge = Number(s.Ghe.LoaiGhe.PhuThu);
    const price = calculateSeatPrice(basePrice, roomSurcharge, daySurcharge, seatSurcharge, s.Ghe.SucChua);
    totalAmount += price;
    return {
      seatId: s.MaGheSuatChieu,
      price,
      tenGhe: `${s.Ghe.ViTriDay}${s.Ghe.ViTriCot}`,
    };
  });

  // 5. Execute counter sales transaction
  const result = await sellTicketsAtCounterTransaction(
    staff.MaNhanVien,
    body.MaSuatChieu,
    body.DanhSachMaGheSuatChieu,
    body.PhuongThuc,
    body.MaGiaoDichNgoai,
    now,
    calculatedPrices,
    totalAmount,
  );

  return {
    MaPhieuDat: result.phieuDatVe.MaPhieuDat,
    TongTien: totalAmount,
    TrangThai: result.phieuDatVe.TrangThai,
    NgayTao: result.phieuDatVe.NgayTao,
    QRPayload: `QR_${result.phieuDatVe.MaPhieuDat}`,
    MaNhanVien: result.phieuDatVe.MaNhanVien,
    GiaoDich: {
      MaGiaoDich: result.giaoDich.MaGiaoDich,
      PhuongThuc: result.giaoDich.PhuongThuc,
      SoTien: Number(result.giaoDich.SoTien),
      TrangThai: result.giaoDich.TrangThai,
      MaGiaoDichNgoai: result.giaoDich.MaGiaoDichNgoai,
    },
    DanhSachGhe: calculatedPrices.map((sp) => ({
      MaGheSuatChieu: sp.seatId,
      TenGhe: sp.tenGhe,
      GiaVe: sp.price,
    })),
  };
};

/**
 * Get ticket sales history (POS counter sales) for a staff member
 */
export const getSalesHistoryForStaff = async (
  maTaiKhoan: string,
  queryFilters: { page: number; limit: number; tuNgay?: Date; denNgay?: Date; keyword?: string },
) => {
  const staff = await findStaffByAccountId(maTaiKhoan);
  if (!staff) {
    throw new UnauthorizedError('Tài khoản đã bị vô hiệu hóa hoặc không có quyền nhân viên');
  }

  const { page, limit, tuNgay, denNgay, keyword } = queryFilters;
  const skip = (page - 1) * limit;

  const where: any = {
    MaNhanVien: staff.MaNhanVien,
    TrangThai: 'DA_THANH_TOAN',
    KhaDung: true,
  };

  if (tuNgay || denNgay) {
    where.NgayTao = {};
    if (tuNgay) {
      where.NgayTao.gte = tuNgay;
    }
    if (denNgay) {
      where.NgayTao.lte = denNgay;
    }
  }

  if (keyword) {
    where.OR = [
      {
        MaPhieuDat: { contains: keyword },
      },
      {
        ChiTietDatVes: {
          some: {
            GheSuatChieu: {
              SuatChieu: {
                Phim: {
                  TenPhim: { contains: keyword },
                },
              },
            },
          },
        },
      },
    ];
  }

  const [sales, total] = await Promise.all([
    prisma.phieuDatVe.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        NgayTao: 'desc',
      },
      include: {
        GiaoDichs: {
          where: { KhaDung: true },
        },
        ChiTietDatVes: {
          where: { KhaDung: true },
          include: {
            GheSuatChieu: {
              include: {
                SuatChieu: {
                  include: {
                    Phim: true,
                    PhongChieu: true,
                  },
                },
                Ghe: true,
              },
            },
          },
        },
      },
    }),
    prisma.phieuDatVe.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  const mappedSales = sales.map((sale) => {
    const firstTicket = sale.ChiTietDatVes[0];
    const suatChieu = firstTicket?.GheSuatChieu.SuatChieu;
    const phim = suatChieu?.Phim;
    const phong = suatChieu?.PhongChieu;
    const seats = sale.ChiTietDatVes
      .map((ct) => `${ct.GheSuatChieu.Ghe.ViTriDay}${ct.GheSuatChieu.Ghe.ViTriCot}`)
      .join(', ');

    return {
      MaPhieuDat: sale.MaPhieuDat,
      NgayTao: sale.NgayTao,
      TongTien: Number(sale.TongTien),
      Phim: phim ? { TenPhim: phim.TenPhim } : null,
      PhongChieu: phong ? { TenPhong: phong.TenPhong } : null,
      Ghe: seats,
      SuatChieu: suatChieu
        ? {
            NgayChieu: suatChieu.NgayChieu,
            GioChieu: suatChieu.GioChieu,
          }
        : null,
      PhuongThuc: sale.GiaoDichs[0]?.PhuongThuc || 'TIEN_MAT',
    };
  });

  return {
    history: mappedSales,
    total,
    page,
    limit,
    totalPages,
  };
};
