import { Prisma, Role, TaiKhoan, NhanVien, SuatChieu, PhuongThucThanhToan } from '@prisma/client';
import prisma from '../../../config/prisma';
import { BadRequestError } from '../../../utils/errors';

export interface ShowtimeFilters {
  keyword?: string;
  ngayChieu?: Date;
  maPhim?: string;
  maPhong?: string;
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
 * Find all showtimes starting from today with filters (database part)
 */
export const findAvailableShowtimesForStaff = async (
  filters: ShowtimeFilters,
) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const where: any = {
    KhaDung: true,
    Phim: {
      KhaDung: true,
    },
    PhongChieu: {
      KhaDung: true,
    },
    NgayChieu: {
      gte: today,
    },
  };

  if (filters.maPhim) {
    where.MaPhim = filters.maPhim;
  }
  if (filters.maPhong) {
    where.MaPhong = filters.maPhong;
  }
  if (filters.ngayChieu) {
    where.NgayChieu = filters.ngayChieu;
  }
  if (filters.keyword) {
    where.Phim.TenPhim = {
      contains: filters.keyword,
    };
  }

  return prisma.suatChieu.findMany({
    where,
    orderBy: [
      { NgayChieu: 'asc' },
      { GioChieu: 'asc' },
    ],
    include: {
      Phim: true,
      PhongChieu: {
        include: {
          LoaiPhong: true,
        },
      },
      LoaiNgay: true,
      GheSuatChieus: {
        where: {
          KhaDung: true,
        },
        select: {
          TrangThai: true,
          ThoiGianGiuGhe: true,
        },
      },
    },
  });
};

/**
 * Find seat map for staff view
 */
export const findStaffSeatMap = async (maSuatChieu: string) => {
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

/**
 * Release expired holds targetting a specific showtime (similar to ghesuatchieu repository)
 */
export const releaseExpiredHolds = async (now: Date, maSuatChieu: string) => {
  return prisma.gheSuatChieu.updateMany({
    where: {
      MaSuatChieu: maSuatChieu,
      TrangThai: 'DANG_GIU',
      ThoiGianGiuGhe: { lt: now },
    },
    data: {
      TrangThai: 'TRONG',
      ThoiGianGiuGhe: null,
      MaTaiKhoanGiu: null,
    },
  });
};

/**
 * Perform POS counter ticket selling in a single transaction
 */
export const sellTicketsAtCounterTransaction = async (
  maNhanVien: string,
  maSuatChieu: string,
  seatIds: string[],
  phuongThuc: PhuongThucThanhToan,
  maGiaoDichNgoai: string | undefined,
  now: Date,
  calculatedPrices: { seatId: string; price: number }[],
  total: number,
) => {
  return prisma.$transaction(async (tx) => {
    // 1. Release expired holds for this showtime first (within transaction)
    await tx.gheSuatChieu.updateMany({
      where: {
        MaSuatChieu: maSuatChieu,
        MaGheSuatChieu: { in: seatIds },
        TrangThai: 'DANG_GIU',
        ThoiGianGiuGhe: { lt: now },
      },
      data: {
        TrangThai: 'TRONG',
        ThoiGianGiuGhe: null,
        MaTaiKhoanGiu: null,
      },
    });

    // 2. Lock and reserve seats: check if they are TRONG
    const result = await tx.gheSuatChieu.updateMany({
      where: {
        MaGheSuatChieu: { in: seatIds },
        MaSuatChieu: maSuatChieu,
        KhaDung: true,
        TrangThai: 'TRONG',
      },
      data: {
        TrangThai: 'DA_DAT',
        ThoiGianGiuGhe: null,
        MaTaiKhoanGiu: null,
      },
    });

    // If updated count does not equal requested count, throw error to rollback
    if (result.count !== seatIds.length) {
      throw new BadRequestError('Ghế đã được đặt hoặc đang được giữ');
    }

    // 3. Create PhieuDatVe
    const phieuDatVe = await tx.phieuDatVe.create({
      data: {
        MaKhachHang: null,
        MaNhanVien: maNhanVien,
        TongTien: total,
        TrangThai: 'DA_THANH_TOAN',
        KhaDung: true,
      },
    });

    // 4. Create ChiTietDatVe for each seat
    for (const item of calculatedPrices) {
      await tx.chiTietDatVe.create({
        data: {
          MaPhieuDat: phieuDatVe.MaPhieuDat,
          MaGheSuatChieu: item.seatId,
          GiaVe: item.price,
          KhaDung: true,
        },
      });
    }

    // Explicitly update selected GheSuatChieu to TrangThai = DA_DAT, ThoiGianGiuGhe = null, MaTaiKhoanGiu = null after creating ChiTietDatVe
    await tx.gheSuatChieu.updateMany({
      where: {
        MaGheSuatChieu: { in: seatIds },
        MaSuatChieu: maSuatChieu,
      },
      data: {
        TrangThai: 'DA_DAT',
        ThoiGianGiuGhe: null,
        MaTaiKhoanGiu: null,
      },
    });

    // 5. Create GiaoDich
    const externalTxCode = maGiaoDichNgoai || 'POS_' + Math.floor(100000 + Math.random() * 900000).toString() + '_' + Date.now().toString();

    const giaoDich = await tx.giaoDich.create({
      data: {
        MaPhieuDat: phieuDatVe.MaPhieuDat,
        PhuongThuc: phuongThuc,
        SoTien: total,
        TrangThai: 'THANH_CONG',
        MaGiaoDichNgoai: externalTxCode,
        KhaDung: true,
      },
    });

    return {
      phieuDatVe,
      giaoDich,
    };
  });
};
