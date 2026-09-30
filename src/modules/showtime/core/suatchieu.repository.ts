import { SuatChieu, GheSuatChieu, Prisma } from '@prisma/client';
import prisma from '../../../config/prisma';

export interface SuatChieuFilters {
  maPhim?: string;
  maPhong?: string;
  ngayChieu?: Date;
  khaDung?: boolean;
}

/**
 * Find all showtimes matching filters
 */
export const findSuatChieus = async (filters: SuatChieuFilters): Promise<any[]> => {
  const whereClause: Prisma.SuatChieuWhereInput = {};

  if (filters.maPhim) {
    whereClause.MaPhim = filters.maPhim;
  }
  if (filters.maPhong) {
    whereClause.MaPhong = filters.maPhong;
  }
  if (filters.ngayChieu) {
    // Exact date match (comparing midnight UTC dates)
    const startDate = new Date(filters.ngayChieu);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 1);

    whereClause.NgayChieu = {
      gte: startDate,
      lt: endDate,
    };
  }
  if (filters.khaDung !== undefined) {
    whereClause.KhaDung = filters.khaDung;
  }

  return prisma.suatChieu.findMany({
    where: whereClause,
    include: {
      Phim: {
        select: {
          TenPhim: true,
          ThoiLuong: true,
          HinhAnh: true,
          GioiHanTuoi: true,
        },
      },
      PhongChieu: {
        select: {
          TenPhong: true,
          LoaiPhong: {
            select: {
              TenLoaiPhong: true,
            },
          },
        },
      },
      LoaiNgay: {
        select: {
          TenLoaiNgay: true,
          PhuThu: true,
        },
      },
    },
    orderBy: [
      { NgayChieu: 'asc' },
      { GioChieu: 'asc' },
    ],
  });
};

/**
 * Find a single showtime by ID
 */
export const findSuatChieuById = async (maSuatChieu: string): Promise<any | null> => {
  return prisma.suatChieu.findUnique({
    where: { MaSuatChieu: maSuatChieu },
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
};

/**
 * Find showtimes in the same room for checking time conflicts (over 3 days: NgayChieu - 1 to NgayChieu + 1)
 */
export const findOverlappingShowtimes = async (
  maPhong: string,
  ngayChieu: Date,
  excludeMaSuatChieu?: string,
): Promise<any[]> => {
  const targetDate = new Date(ngayChieu);
  
  const prevDate = new Date(targetDate);
  prevDate.setUTCDate(targetDate.getUTCDate() - 1);
  prevDate.setUTCHours(0, 0, 0, 0);

  const nextDate = new Date(targetDate);
  nextDate.setUTCDate(targetDate.getUTCDate() + 1);
  nextDate.setUTCHours(23, 59, 59, 999);

  return prisma.suatChieu.findMany({
    where: {
      MaPhong: maPhong,
      KhaDung: true,
      NgayChieu: {
        gte: prevDate,
        lte: nextDate,
      },
      ...(excludeMaSuatChieu && {
        MaSuatChieu: { not: excludeMaSuatChieu },
      }),
    },
    include: {
      Phim: {
        select: {
          ThoiLuong: true,
        },
      },
    },
  });
};

/**
 * Create a showtime record
 */
export const createSuatChieu = async (
  data: Prisma.SuatChieuUncheckedCreateInput,
  tx?: Prisma.TransactionClient,
): Promise<SuatChieu> => {
  const client = tx || prisma;
  return client.suatChieu.create({ data });
};

/**
 * Update a showtime record
 */
export const updateSuatChieu = async (
  maSuatChieu: string,
  data: Prisma.SuatChieuUncheckedUpdateInput,
  tx?: Prisma.TransactionClient,
): Promise<SuatChieu> => {
  const client = tx || prisma;
  return client.suatChieu.update({
    where: { MaSuatChieu: maSuatChieu },
    data,
  });
};

/**
 * Delete a showtime record
 */
export const deleteSuatChieu = async (
  maSuatChieu: string,
  tx?: Prisma.TransactionClient,
): Promise<SuatChieu> => {
  const client = tx || prisma;
  return client.suatChieu.delete({
    where: { MaSuatChieu: maSuatChieu },
  });
};

/**
 * Count the number of ticket details booked for this showtime
 */
export const countSoldTickets = async (maSuatChieu: string): Promise<number> => {
  return prisma.chiTietDatVe.count({
    where: {
      GheSuatChieu: {
        MaSuatChieu: maSuatChieu,
      },
    },
  });
};

// ==========================================
// Showtime Seats (GheSuatChieu) Queries
// ==========================================

/**
 * Find all seats for a specific showtime, ordered by row and column
 */
export const findGheSuatChieusByShowtime = async (maSuatChieu: string): Promise<any[]> => {
  return prisma.gheSuatChieu.findMany({
    where: { MaSuatChieu: maSuatChieu },
    include: {
      Ghe: {
        include: {
          LoaiGhe: true,
        },
      },
    },
    orderBy: [
      { Ghe: { ViTriDay: 'asc' } },
      { Ghe: { ViTriCot: 'asc' } },
    ],
  });
};

/**
 * Create multiple showtime seats
 */
export const createGheSuatChieus = async (
  data: Prisma.GheSuatChieuUncheckedCreateInput[],
  tx?: Prisma.TransactionClient,
): Promise<Prisma.BatchPayload> => {
  const client = tx || prisma;
  return client.gheSuatChieu.createMany({ data });
};

/**
 * Delete all showtime seats for a showtime
 */
export const deleteGheSuatChieusByShowtime = async (
  maSuatChieu: string,
  tx?: Prisma.TransactionClient,
): Promise<Prisma.BatchPayload> => {
  const client = tx || prisma;
  return client.gheSuatChieu.deleteMany({
    where: { MaSuatChieu: maSuatChieu },
  });
};

/**
 * Get showtime and all active related seat map models
 */
export const findShowtimeForSeatMap = async (maSuatChieu: string) => {
  return prisma.suatChieu.findFirst({
    where: {
      MaSuatChieu: maSuatChieu,
      KhaDung: true,
      PhongChieu: {
        KhaDung: true,
        LoaiPhong: {
          KhaDung: true,
        },
        SoDoGhe: {
          KhaDung: true,
        },
      },
    },
    include: {
      Phim: true,
      LoaiNgay: true,
      PhongChieu: {
        include: {
          LoaiPhong: true,
          SoDoGhe: true,
        },
      },
      GheSuatChieus: {
        where: {
          KhaDung: true,
          Ghe: {
            KhaDung: true,
            LoaiGhe: {
              KhaDung: true,
            },
          },
        },
        include: {
          Ghe: {
            include: {
              LoaiGhe: true,
            },
          },
        },
      },
    },
  });
};
