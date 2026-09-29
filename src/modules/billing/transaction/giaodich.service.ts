import {
  TrangThaiPhieuDatVe,
  TrangThaiGheSuatChieu,
  TrangThaiGiaoDich,
  TrangThaiHoanTien,
  PhieuDatVe,
  GiaoDich,
} from '@prisma/client';
import prisma from '../../../config/prisma';
import { PhieuDatQueryInput, HoanTienInput } from './giaodich.validator';
import { NotFoundError, BadRequestError } from '../../../utils/errors';
import { cancelRefundedBooking, claimRefundTransaction } from '../refund/refundSettlement';

export const getDanhSachPhieuDatVe = async (
  query: PhieuDatQueryInput,
): Promise<{
  items: any[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const { page, limit, trangThai, search } = query;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (trangThai) {
    where.TrangThai = trangThai;
  }

  if (search) {
    where.OR = [
      { MaPhieuDat: { contains: search } },
      {
        KhachHang: {
          TaiKhoan: {
            OR: [
              { HoTen: { contains: search } },
              { TenDangNhap: { contains: search } },
              { Email: { contains: search } },
              { SoDienThoai: { contains: search } },
            ],
          },
        },
      },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.phieuDatVe.findMany({
      where,
      include: {
        KhachHang: {
          include: {
            TaiKhoan: {
              select: {
                HoTen: true,
                Email: true,
                SoDienThoai: true,
                TenDangNhap: true,
              },
            },
          },
        },
        ChiTietDatVes: {
          include: {
            GheSuatChieu: {
              include: {
                Ghe: true,
                SuatChieu: {
                  include: {
                    Phim: {
                      select: {
                        TenPhim: true,
                      },
                    },
                    PhongChieu: {
                      select: {
                        TenPhong: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        GiaoDichs: true,
      },
      orderBy: { NgayTao: 'desc' },
      skip,
      take: limit,
    }),
    prisma.phieuDatVe.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    items,
    page,
    limit,
    total,
    totalPages,
  };
};

export const getChiTietPhieuDatVe = async (maPhieuDat: string): Promise<any> => {
  const phieuDat = await prisma.phieuDatVe.findUnique({
    where: { MaPhieuDat: maPhieuDat },
    include: {
      KhachHang: {
        include: {
          TaiKhoan: {
            select: {
              HoTen: true,
              Email: true,
              SoDienThoai: true,
              TenDangNhap: true,
            },
          },
        },
      },
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
      GiaoDichs: {
        include: {
          LichSuHoanTiens: true,
        },
      },
    },
  });

  if (!phieuDat) {
    throw new NotFoundError('Không tìm thấy phiếu đặt vé');
  }

  return phieuDat;
};

export const huyPhieuDatVe = async (maPhieuDat: string): Promise<PhieuDatVe> => {
  const phieuDat = await prisma.phieuDatVe.findUnique({
    where: { MaPhieuDat: maPhieuDat },
    include: {
      ChiTietDatVes: true,
    },
  });

  if (!phieuDat) {
    throw new NotFoundError('Không tìm thấy phiếu đặt vé');
  }

  if (phieuDat.TrangThai === TrangThaiPhieuDatVe.DA_HUY) {
    return phieuDat;
  }

  if (phieuDat.DaCheckIn) {
    throw new BadRequestError('Vé đã check-in nên không thể hủy');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.phieuDatVe.updateMany({
      where: {
        MaPhieuDat: maPhieuDat,
        DaCheckIn: false,
        TrangThai: { not: TrangThaiPhieuDatVe.DA_HUY },
      },
      data: { TrangThai: TrangThaiPhieuDatVe.DA_HUY },
    });
    if (claimed.count !== 1) {
      throw new BadRequestError('Vé đã check-in hoặc phiếu đặt vé đã bị hủy');
    }

    // Release seats
    const maGheSuatChieus = phieuDat.ChiTietDatVes.map((ct) => ct.MaGheSuatChieu);
    if (maGheSuatChieus.length > 0) {
      await tx.gheSuatChieu.updateMany({
        where: { MaGheSuatChieu: { in: maGheSuatChieus } },
        data: { TrangThai: TrangThaiGheSuatChieu.TRONG },
      });
    }

    // Fail pending/processing transactions
    await tx.giaoDich.updateMany({
      where: {
        MaPhieuDat: maPhieuDat,
        TrangThai: { in: [TrangThaiGiaoDich.CHO_XU_LY] },
      },
      data: { TrangThai: TrangThaiGiaoDich.THAT_BAI },
    });

    return tx.phieuDatVe.findUniqueOrThrow({
      where: { MaPhieuDat: maPhieuDat },
    });
  });

  return updated;
};

export const hoanTienGiaoDich = async (
  maGiaoDich: string,
  input: HoanTienInput,
): Promise<GiaoDich> => {
  const giaoDich = await prisma.giaoDich.findUnique({
    where: { MaGiaoDich: maGiaoDich },
    include: {
      PhieuDatVe: {
        include: {
          ChiTietDatVes: true,
        },
      },
    },
  });

  if (!giaoDich) {
    throw new NotFoundError('Không tìm thấy giao dịch');
  }

  if (giaoDich.TrangThai !== TrangThaiGiaoDich.THANH_CONG) {
    throw new BadRequestError('Giao dịch không ở trạng thái thành công');
  }

  if (giaoDich.PhieuDatVe.DaCheckIn) {
    throw new BadRequestError('Vé đã check-in nên không thể hoàn tiền');
  }

  const transactionAmount = Number(giaoDich.SoTien);
  if (input.SoTienHoan > transactionAmount) {
    throw new BadRequestError('Số tiền hoàn vượt quá số tiền giao dịch');
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Both refund entry points claim this row before touching refund history.
    await claimRefundTransaction(tx, maGiaoDich);
    const pending = await tx.lichSuHoanTien.findFirst({
      where: { MaGiaoDich: maGiaoDich, TrangThai: 'CHO_XU_LY', KhaDung: true },
    });
    if (pending) throw new BadRequestError('Vui lòng xử lý yêu cầu hoàn tiền đang chờ duyệt');

    // 1. Create refund history
    await tx.lichSuHoanTien.create({
      data: {
        MaGiaoDich: maGiaoDich,
        SoTienHoan: input.SoTienHoan,
        LyDo: input.LyDo,
        TrangThai: TrangThaiHoanTien.DA_HOAN,
        NgayHoanTien: new Date(),
        KhaDung: true,
      },
    });

    await cancelRefundedBooking(tx, giaoDich.MaPhieuDat);
    return tx.giaoDich.findUniqueOrThrow({ where: { MaGiaoDich: maGiaoDich } });
  });

  return updated;
};
