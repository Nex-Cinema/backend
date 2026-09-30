import prisma from '../../../config/prisma';

export const findBookingForCheckIn = (maPhieuDat: string) =>
  prisma.phieuDatVe.findFirst({
    where: { MaPhieuDat: maPhieuDat, KhaDung: true },
    include: {
      _count: { select: { ChiTietDatVes: true } },
      ChiTietDatVes: {
        where: { KhaDung: true },
        include: {
          GheSuatChieu: {
            include: {
              SuatChieu: { include: { Phim: true } },
            },
          },
        },
      },
      GiaoDichs: {
        where: { KhaDung: true },
        include: {
          LichSuHoanTiens: {
            where: {
              KhaDung: true,
              TrangThai: { in: ['CHO_XU_LY', 'DA_HOAN'] },
            },
          },
        },
      },
    },
  });

export const markBookingCheckedIn = (
  maPhieuDat: string,
  thoiGianCheckIn: Date,
) =>
  prisma.phieuDatVe.updateMany({
    where: {
      MaPhieuDat: maPhieuDat,
      KhaDung: true,
      TrangThai: 'DA_THANH_TOAN',
      DaCheckIn: false,
      GiaoDichs: {
        some: { TrangThai: 'THANH_CONG', KhaDung: true },
        none: {
          LichSuHoanTiens: {
            some: {
              KhaDung: true,
              TrangThai: { in: ['CHO_XU_LY', 'DA_HOAN'] },
            },
          },
        },
      },
    },
    data: {
      DaCheckIn: true,
      ThoiGianCheckIn: thoiGianCheckIn,
    },
  });
