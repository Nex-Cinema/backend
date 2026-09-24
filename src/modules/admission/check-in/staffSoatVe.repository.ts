import { Role } from '@prisma/client';
import prisma from '../../../config/prisma';

export interface CheckInHistoryFilters {
  keyword?: string;
  tuNgay?: Date;
  denNgay?: Date;
}

/**
 * Find active NhanVien profile by TaiKhoan ID
 */
export const findStaffByAccountId = async (maTaiKhoan: string) => {
  return prisma.nhanVien.findFirst({
    where: {
      MaTaiKhoan: maTaiKhoan,
      KhaDung: true,
      TaiKhoan: {
        KhaDung: true,
        VaiTro: Role.STAFF,
      },
    },
    include: {
      TaiKhoan: true,
    },
  });
};

/**
 * Find seat ticket (ChiTietDatVe) details for check-in validation
 */
export const findTicketForValidation = async (maChiTietDat: string) => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(maChiTietDat);
  if (!isUuid) {
    return null;
  }

  // 1. Check if 'maChiTietDat' is indeed an individual seat ticket detail (MaChiTietDat)
  const ticketByDetailId = await prisma.chiTietDatVe.findFirst({
    where: {
      MaChiTietDat: maChiTietDat,
      KhaDung: true,
    },
    include: {
      PhieuDatVe: {
        include: {
          GiaoDichs: {
            where: { KhaDung: true },
          },
        },
      },
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
  });

  if (ticketByDetailId) {
    return ticketByDetailId;
  }

  // 2. Fall back to checking if 'maChiTietDat' is a Booking ID (MaPhieuDat)
  // Retrieve the first unchecked seat ticket detail in this booking
  const uncheckedTicketInBooking = await prisma.chiTietDatVe.findFirst({
    where: {
      MaPhieuDat: maChiTietDat,
      DaCheckIn: false,
      KhaDung: true,
    },
    include: {
      PhieuDatVe: {
        include: {
          GiaoDichs: {
            where: { KhaDung: true },
          },
        },
      },
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
  });

  if (uncheckedTicketInBooking) {
    return uncheckedTicketInBooking;
  }

  // If no unchecked tickets, grab any ticket in this booking so validation returns "already checked-in"
  return prisma.chiTietDatVe.findFirst({
    where: {
      MaPhieuDat: maChiTietDat,
      KhaDung: true,
    },
    include: {
      PhieuDatVe: {
        include: {
          GiaoDichs: {
            where: { KhaDung: true },
          },
        },
      },
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
  });
};

/**
 * Find active, pending or approved refund requests for a given booking (PhieuDatVe)
 */
export const findRefundStatusForTicket = async (maPhieuDat: string) => {
  return prisma.lichSuHoanTien.findFirst({
    where: {
      KhaDung: true,
      GiaoDich: {
        MaPhieuDat: maPhieuDat,
        KhaDung: true,
      },
      TrangThai: { in: ['CHO_XU_LY', 'DA_HOAN'] },
    },
    orderBy: {
      NgayTao: 'desc',
    },
  });
};

/**
 * Mark seat ticket as checked-in using updateMany to prevent race conditions
 */
export const markSeatCheckedIn = async (maChiTietDat: string, maNhanVien: string, now: Date) => {
  const result = await prisma.chiTietDatVe.updateMany({
    where: {
      MaChiTietDat: maChiTietDat,
      DaCheckIn: false,
      KhaDung: true,
    },
    data: {
      DaCheckIn: true,
      ThoiGianCheckIn: now,
      MaNhanVienCheckIn: maNhanVien,
    },
  });

  return result.count === 1;
};

/**
 * Build Prisma where filter for check-in logs history
 */
const buildHistoryWhere = (filters: CheckInHistoryFilters) => {
  const where: any = {
    DaCheckIn: true,
    KhaDung: true,
  };

  if (filters.tuNgay || filters.denNgay) {
    where.ThoiGianCheckIn = {};
    if (filters.tuNgay) {
      where.ThoiGianCheckIn.gte = filters.tuNgay;
    }
    if (filters.denNgay) {
      where.ThoiGianCheckIn.lte = filters.denNgay;
    }
  }

  if (filters.keyword) {
    where.OR = [
      {
        MaChiTietDat: { contains: filters.keyword },
      },
      {
        GheSuatChieu: {
          SuatChieu: {
            Phim: {
              TenPhim: { contains: filters.keyword },
            },
          },
        },
      },
      {
        GheSuatChieu: {
          SuatChieu: {
            PhongChieu: {
              TenPhong: { contains: filters.keyword },
            },
          },
        },
      },
    ];
  }

  return where;
};

/**
 * Find check-in history logs
 */
export const findCheckInHistory = async (
  filters: CheckInHistoryFilters,
  skip: number,
  take: number,
) => {
  const where = buildHistoryWhere(filters);

  return prisma.chiTietDatVe.findMany({
    where,
    skip,
    take,
    orderBy: {
      ThoiGianCheckIn: 'desc',
    },
    include: {
      NhanVienCheckIn: {
        include: {
          TaiKhoan: {
            select: {
              HoTen: true,
              TenDangNhap: true,
            },
          },
        },
      },
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
  });
};

/**
 * Count check-in history logs
 */
export const countCheckInHistory = async (filters: CheckInHistoryFilters) => {
  const where = buildHistoryWhere(filters);
  return prisma.chiTietDatVe.count({ where });
};
