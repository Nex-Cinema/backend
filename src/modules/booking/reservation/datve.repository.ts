import prisma from '../../../config/prisma';
import { PhuongThucThanhToan } from '@prisma/client';
import { BadRequestError } from '../../../utils/errors';

/**
 * Retrieve GHE_SUATCHIEU details, including related seat/room types to compute the price
 */
export const findHeldSeatsForPayment = async (
  maSuatChieu: string,
  seatIds: string[],
  maTaiKhoan: string,
  now: Date,
) => {
  return prisma.gheSuatChieu.findMany({
    where: {
      MaSuatChieu: maSuatChieu,
      MaGheSuatChieu: { in: seatIds },
      TrangThai: 'DANG_GIU',
      MaTaiKhoanGiu: maTaiKhoan,
      ThoiGianGiuGhe: { gte: now },
      KhaDung: true,
    },
    include: {
      Ghe: {
        include: {
          LoaiGhe: true,
        },
      },
      SuatChieu: {
        include: {
          PhongChieu: {
            include: {
              LoaiPhong: true,
            },
          },
          LoaiNgay: true,
        },
      },
    },
  });
};

/**
 * Transaction to update seats to DA_DAT, create PhieuDatVe, ChiTietDatVe, and GiaoDich
 */
export const createPaidBookingTransaction = async (
  maKhachHang: string,
  maSuatChieu: string,
  seatIds: string[],
  phuongThuc: PhuongThucThanhToan,
  maThamChieuDoiTac: string,
  tongTien: number,
  seatPrices: { maGheSuatChieu: string; price: number }[],
  maTaiKhoan: string,
) => {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // 1. Update GheSuatChieu to DA_DAT – strictly re-verify ownership and expiry
    //    to guard against race conditions between the pre-check SELECT and this UPDATE.
    const updateResult = await tx.gheSuatChieu.updateMany({
      where: {
        MaSuatChieu: maSuatChieu,
        MaGheSuatChieu: { in: seatIds },
        TrangThai: 'DANG_GIU',
        MaTaiKhoanGiu: maTaiKhoan,          // must still be owned by this user
        ThoiGianGiuGhe: { gte: now },        // hold must not have expired
      },
      data: {
        TrangThai: 'DA_DAT',
        ThoiGianGiuGhe: null,
        MaTaiKhoanGiu: null,
      },
    });

    if (updateResult.count !== seatIds.length) {
      throw new BadRequestError('Một số ghế đã hết hạn giữ hoặc không còn thuộc quyền sở hữu của bạn.');
    }

    // 2. Create PhieuDatVe
    const phieuDatVe = await tx.phieuDatVe.create({
      data: {
        MaKhachHang: maKhachHang,
        TongTien: tongTien,
        TrangThai: 'DA_THANH_TOAN',
        KhaDung: true,
      },
    });

    // 3. Create ChiTietDatVe for each seat
    for (const sp of seatPrices) {
      await tx.chiTietDatVe.create({
        data: {
          MaPhieuDat: phieuDatVe.MaPhieuDat,
          MaGheSuatChieu: sp.maGheSuatChieu,
          GiaVe: sp.price,
          KhaDung: true,
        },
      });
    }

    // 4. Create GiaoDich
    const giaoDich = await tx.giaoDich.create({
      data: {
        MaPhieuDat: phieuDatVe.MaPhieuDat,
        PhuongThuc: phuongThuc,
        SoTien: tongTien,
        TrangThai: 'THANH_CONG',
        MaGiaoDichNgoai: maThamChieuDoiTac,
        NgayGiaoDich: new Date(),
        KhaDung: true,
      },
    });

    return {
      phieuDatVe,
      giaoDich,
    };
  });
};

/**
 * Release held seats inside a transaction context
 */
export const releaseHeldSeats = async (
  tx: any,
  maSuatChieu: string,
  seatIds: string[],
  maTaiKhoan: string,
) => {
  return tx.gheSuatChieu.updateMany({
    where: {
      MaSuatChieu: maSuatChieu,
      MaGheSuatChieu: { in: seatIds },
      TrangThai: 'DANG_GIU',
      MaTaiKhoanGiu: maTaiKhoan,
    },
    data: {
      TrangThai: 'TRONG',
      ThoiGianGiuGhe: null,
      MaTaiKhoanGiu: null,
    },
  });
};

/**
 * Find booking by ID for a specific customer
 */
export const findBookingForCustomer = async (maPhieuDat: string, maKhachHang: string) => {
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
              SuatChieu: true,
            },
          },
        },
      },
    },
  });
};

/**
 * Cancel unpaid booking and release seats
 */
export const cancelBooking = async (maPhieuDat: string, seatIds: string[]) => {
  return prisma.$transaction(async (tx) => {
    // 1. Update booking status
    await tx.phieuDatVe.update({
      where: { MaPhieuDat: maPhieuDat },
      data: { TrangThai: 'DA_HUY' },
    });

    // 2. Release seats
    await tx.gheSuatChieu.updateMany({
      where: {
        MaGheSuatChieu: { in: seatIds },
      },
      data: {
        TrangThai: 'TRONG',
        ThoiGianGiuGhe: null,
        MaTaiKhoanGiu: null,
      },
    });
  });
};

/**
 * Create a refund request
 */
export const createRefundRequest = async (
  tx: any,
  maGiaoDich: string,
  soTienHoan: number,
  lyDo: string,
  bankInfo?: { TenNganHang: string; SoTaiKhoan: string; TenChuTaiKhoan: string },
) => {
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
};

/**
 * Find pending refund request by booking ID
 */
export const findPendingRefundRequest = async (maPhieuDat: string) => {
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
 * Transaction to create a pending booking (CHO_THANH_TOAN) and pending transaction (CHO_XU_LY)
 * while keeping seats in DANG_GIU status so they are reserved.
 */
export const createPendingBookingTransaction = async (
  maKhachHang: string,
  maSuatChieu: string,
  seatIds: string[],
  phuongThuc: PhuongThucThanhToan,
  tongTien: number,
  seatPrices: { maGheSuatChieu: string; price: number }[],
  maTaiKhoan: string,
  paymentExpiresAt: Date,
) => {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // 1. Verify seats are still held by the user and not expired
    const heldSeatsCount = await tx.gheSuatChieu.count({
      where: {
        MaSuatChieu: maSuatChieu,
        MaGheSuatChieu: { in: seatIds },
        TrangThai: 'DANG_GIU',
        MaTaiKhoanGiu: maTaiKhoan,
        ThoiGianGiuGhe: { gte: now },
      },
    });

    if (heldSeatsCount !== seatIds.length) {
      throw new BadRequestError('Một số ghế đã hết hạn giữ hoặc không còn thuộc quyền sở hữu của bạn.');
    }

    // Note: We do NOT set seats to DA_DAT yet. We keep them as DANG_GIU.
    // Refresh the deadline using the same operational policy as the initial hold.
    await tx.gheSuatChieu.updateMany({
      where: {
        MaSuatChieu: maSuatChieu,
        MaGheSuatChieu: { in: seatIds },
      },
      data: {
        ThoiGianGiuGhe: paymentExpiresAt,
      },
    });

    // 2. Create PhieuDatVe in CHO_THANH_TOAN status
    const phieuDatVe = await tx.phieuDatVe.create({
      data: {
        MaKhachHang: maKhachHang,
        TongTien: tongTien,
        TrangThai: 'CHO_THANH_TOAN',
        KhaDung: true,
      },
    });

    // 3. Create ChiTietDatVe for each seat
    for (const sp of seatPrices) {
      await tx.chiTietDatVe.create({
        data: {
          MaPhieuDat: phieuDatVe.MaPhieuDat,
          MaGheSuatChieu: sp.maGheSuatChieu,
          GiaVe: sp.price,
          KhaDung: true,
        },
      });
    }

    // 4. Create GiaoDich in CHO_XU_LY (Pending) status
    const giaoDich = await tx.giaoDich.create({
      data: {
        MaPhieuDat: phieuDatVe.MaPhieuDat,
        PhuongThuc: phuongThuc,
        SoTien: tongTien,
        TrangThai: 'CHO_XU_LY',
        MaGiaoDichNgoai: null,
        NgayGiaoDich: new Date(),
        KhaDung: true,
      },
    });

    return {
      phieuDatVe,
      giaoDich,
    };
  });
};
