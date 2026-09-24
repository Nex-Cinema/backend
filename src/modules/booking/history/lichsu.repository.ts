import prisma from '../../../config/prisma';
import { Prisma } from '@prisma/client';

/**
 * Retrieve paginated booking history for a specific customer with optional filters
 */
export const findBookingHistoryByCustomer = async (
  maKhachHang: string,
  filters: { trangThai?: string; tuNgay?: Date; denNgay?: Date },
  skip: number,
  limit: number,
) => {
  const whereClause: Prisma.PhieuDatVeWhereInput = {
    MaKhachHang: maKhachHang,
    KhaDung: true,
    ...(filters.trangThai && { TrangThai: filters.trangThai as any }),
    ...((filters.tuNgay || filters.denNgay) && {
      NgayTao: {
        ...(filters.tuNgay && { gte: filters.tuNgay }),
        ...(filters.denNgay && { lte: filters.denNgay }),
      },
    }),
  };

  return prisma.phieuDatVe.findMany({
    where: whereClause,
    skip,
    take: limit,
    orderBy: {
      NgayTao: 'desc',
    },
    include: {
      ChiTietDatVes: {
        include: {
          GheSuatChieu: {
            include: {
              Ghe: true,
              SuatChieu: {
                include: {
                  Phim: true,
                  PhongChieu: true,
                },
              },
            },
          },
        },
      },
      GiaoDichs: true,
    },
  });
};

/**
 * Count total booking history records for a specific customer with filters
 */
export const countBookingHistoryByCustomer = async (
  maKhachHang: string,
  filters: { trangThai?: string; tuNgay?: Date; denNgay?: Date },
) => {
  const whereClause: Prisma.PhieuDatVeWhereInput = {
    MaKhachHang: maKhachHang,
    KhaDung: true,
    ...(filters.trangThai && { TrangThai: filters.trangThai as any }),
    ...((filters.tuNgay || filters.denNgay) && {
      NgayTao: {
        ...(filters.tuNgay && { gte: filters.tuNgay }),
        ...(filters.denNgay && { lte: filters.denNgay }),
      },
    }),
  };

  return prisma.phieuDatVe.count({
    where: whereClause,
  });
};

/**
 * Fetch booking details including seats, movies, showtime types, transactions and refund logs
 */
export const findBookingDetailByCustomer = async (
  maPhieuDat: string,
  maKhachHang: string,
) => {
  return prisma.phieuDatVe.findFirst({
    where: {
      MaPhieuDat: maPhieuDat,
      MaKhachHang: maKhachHang,
      KhaDung: true,
    },
    include: {
      ChiTietDatVes: {
        include: {
          GheSuatChieu: {
            include: {
              Ghe: {
                include: {
                  LoaiGhe: true,
                },
              },
              SuatChieu: {
                include: {
                  Phim: true,
                  PhongChieu: {
                    include: {
                      LoaiPhong: true,
                    },
                  },
                  LoaiNgay: true,
                },
              },
            },
          },
        },
      },
      GiaoDichs: {
        include: {
          LichSuHoanTiens: {
            where: { KhaDung: true },
          },
        },
      },
    },
  });
};
