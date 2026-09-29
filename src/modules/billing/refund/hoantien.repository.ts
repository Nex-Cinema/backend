import prisma from '../../../config/prisma';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import { cancelRefundedBooking, claimRefundTransaction } from './refundSettlement';

/**
 * Find successful transaction by booking ID
 */
export const findSuccessfulTransactionByBooking = async (maPhieuDat: string) => {
  return prisma.giaoDich.findFirst({
    where: {
      MaPhieuDat: maPhieuDat,
      TrangThai: 'THANH_CONG',
      KhaDung: true,
    },
  });
};

/**
 * Check if a pending refund request already exists for a booking
 */
export const findPendingRefundByBooking = async (maPhieuDat: string) => {
  return prisma.lichSuHoanTien.findFirst({
    where: {
      GiaoDich: {
        MaPhieuDat: maPhieuDat,
      },
      TrangThai: 'CHO_XU_LY',
      KhaDung: true,
    },
  });
};

/**
 * Create a refund request and update booking status to DA_HUY in a Prisma transaction
 */
export const createRefundRequest = async (
  maPhieuDat: string,
  maGiaoDich: string,
  soTienHoan: number,
  lyDo: string,
  bankInfo?: { TenNganHang: string; SoTaiKhoan: string; TenChuTaiKhoan: string },
) => {
  return prisma.$transaction(async (tx) => {
    // 1. Claim the booking so refund and check-in cannot both succeed.
    const claimed = await tx.phieuDatVe.updateMany({
      where: {
        MaPhieuDat: maPhieuDat,
        TrangThai: { in: ['DA_THANH_TOAN', 'DA_HUY'] },
        DaCheckIn: false,
      },
      data: { TrangThai: 'DA_HUY' },
    });
    if (claimed.count !== 1) {
      throw new BadRequestError('Vé đã check-in hoặc không còn có thể hoàn tiền.');
    }

    // 2. Create LichSuHoanTien
    return tx.lichSuHoanTien.create({
      data: {
        MaGiaoDich: maGiaoDich,
        SoTienHoan: soTienHoan,
        LyDo: lyDo,
        TrangThai: 'CHO_XU_LY',
        NgayHoanTien: null,
        KhaDung: true,
        TenNganHang: bankInfo?.TenNganHang || null,
        SoTaiKhoan: bankInfo?.SoTaiKhoan || null,
        TenChuTaiKhoan: bankInfo?.TenChuTaiKhoan || null,
      },
    });
  });
};

/**
 * Retrieve paginated refund requests for a specific customer
 */
export const findRefundRequestsByCustomer = async (
  maKhachHang: string,
  skip: number,
  limit: number,
) => {
  return prisma.lichSuHoanTien.findMany({
    where: {
      GiaoDich: {
        PhieuDatVe: {
          MaKhachHang: maKhachHang,
          KhaDung: true,
        },
      },
      KhaDung: true,
    },
    skip,
    take: limit,
    orderBy: {
      NgayTao: 'desc',
    },
    include: {
      GiaoDich: {
        include: {
          PhieuDatVe: {
            include: {
              ChiTietDatVes: {
                include: {
                  GheSuatChieu: {
                    include: {
                      SuatChieu: {
                        include: {
                          Phim: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
};

/**
 * Count total refund requests for a customer
 */
export const countRefundRequestsByCustomer = async (maKhachHang: string) => {
  return prisma.lichSuHoanTien.count({
    where: {
      GiaoDich: {
        PhieuDatVe: {
          MaKhachHang: maKhachHang,
          KhaDung: true,
        },
      },
      KhaDung: true,
    },
  });
};

/**
 * Retrieve paginated and filtered refund requests for ADMIN
 */
export const findRefundRequestsAdmin = async (
  skip: number,
  limit: number,
  trangThai?: any,
  keyword?: string,
) => {
  const where: any = { KhaDung: true };

  if (trangThai) {
    where.TrangThai = trangThai;
  }

  if (keyword) {
    const keywordTrimmed = keyword.trim();
    where.OR = [
      { MaHoanTien: { contains: keywordTrimmed } },
      { LyDo: { contains: keywordTrimmed } },
      {
        GiaoDich: {
          OR: [
            { MaGiaoDich: { contains: keywordTrimmed } },
            { MaGiaoDichNgoai: { contains: keywordTrimmed } },
            {
              PhieuDatVe: {
                OR: [
                  { MaPhieuDat: { contains: keywordTrimmed } },
                  {
                    KhachHang: {
                      TaiKhoan: {
                        OR: [
                          { HoTen: { contains: keywordTrimmed } },
                          { Email: { contains: keywordTrimmed } },
                          { SoDienThoai: { contains: keywordTrimmed } },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ];
  }

  return prisma.lichSuHoanTien.findMany({
    where,
    skip,
    take: limit,
    orderBy: {
      NgayTao: 'desc',
    },
    include: {
      GiaoDich: {
        include: {
          PhieuDatVe: {
            include: {
              KhachHang: {
                include: {
                  TaiKhoan: {
                    select: {
                      MaTaiKhoan: true,
                      HoTen: true,
                      Email: true,
                      SoDienThoai: true,
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
            },
          },
        },
      },
    },
  });
};

/**
 * Count total refund requests matching filters for ADMIN
 */
export const countRefundRequestsAdmin = async (
  trangThai?: any,
  keyword?: string,
) => {
  const where: any = { KhaDung: true };

  if (trangThai) {
    where.TrangThai = trangThai;
  }

  if (keyword) {
    const keywordTrimmed = keyword.trim();
    where.OR = [
      { MaHoanTien: { contains: keywordTrimmed } },
      { LyDo: { contains: keywordTrimmed } },
      {
        GiaoDich: {
          OR: [
            { MaGiaoDich: { contains: keywordTrimmed } },
            { MaGiaoDichNgoai: { contains: keywordTrimmed } },
            {
              PhieuDatVe: {
                OR: [
                  { MaPhieuDat: { contains: keywordTrimmed } },
                  {
                    KhachHang: {
                      TaiKhoan: {
                        OR: [
                          { HoTen: { contains: keywordTrimmed } },
                          { Email: { contains: keywordTrimmed } },
                          { SoDienThoai: { contains: keywordTrimmed } },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ];
  }

  return prisma.lichSuHoanTien.count({
    where,
  });
};

/**
 * Find a specific refund request by ID with full nested include for ADMIN
 */
export const findRefundRequestByIdAdmin = async (maHoanTien: string) => {
  return prisma.lichSuHoanTien.findFirst({
    where: {
      MaHoanTien: maHoanTien,
      KhaDung: true,
    },
    include: {
      GiaoDich: {
        include: {
          PhieuDatVe: {
            include: {
              KhachHang: {
                include: {
                  TaiKhoan: {
                    select: {
                      MaTaiKhoan: true,
                      HoTen: true,
                      Email: true,
                      SoDienThoai: true,
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
            },
          },
        },
      },
    },
  });
};

/**
 * Approve a pending refund request in a transaction
 */
export const approveRefundRequest = async (
  maHoanTien: string,
) => {
  return prisma.$transaction(async (tx) => {
    const refund = await tx.lichSuHoanTien.findFirst({
      where: { MaHoanTien: maHoanTien, KhaDung: true },
      include: { GiaoDich: true },
    });
    if (!refund) throw new NotFoundError('Không tìm thấy yêu cầu hoàn tiền');
    if (refund.TrangThai !== 'CHO_XU_LY') throw new BadRequestError('Yêu cầu hoàn tiền đã được xử lý');
    if (refund.SoTienHoan.lte(0) || refund.SoTienHoan.gt(refund.GiaoDich.SoTien)) {
      throw new BadRequestError('Số tiền hoàn không hợp lệ');
    }
    await claimRefundTransaction(tx, refund.MaGiaoDich);
    const claimed = await tx.lichSuHoanTien.updateMany({
      where: { MaHoanTien: maHoanTien, TrangThai: 'CHO_XU_LY', KhaDung: true },
      data: {
        TrangThai: 'DA_HOAN',
        NgayHoanTien: new Date(),
      },
    });
    if (claimed.count !== 1) throw new BadRequestError('Yêu cầu hoàn tiền đã được xử lý');
    await cancelRefundedBooking(tx, refund.GiaoDich.MaPhieuDat);
    return tx.lichSuHoanTien.findUniqueOrThrow({ where: { MaHoanTien: maHoanTien } });
  });
};

/**
 * Reject a pending refund request
 */
export const rejectRefundRequest = async (maHoanTien: string) => {
  const result = await prisma.lichSuHoanTien.updateMany({
    where: { MaHoanTien: maHoanTien, TrangThai: 'CHO_XU_LY', KhaDung: true },
    data: {
      TrangThai: 'TU_CHOI',
    },
  });
  if (result.count !== 1) throw new BadRequestError('Yêu cầu hoàn tiền đã được xử lý');
  return prisma.lichSuHoanTien.findUniqueOrThrow({ where: { MaHoanTien: maHoanTien } });
};
