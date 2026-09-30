import prisma from '../../../config/prisma';
import { Prisma } from '@prisma/client';
import { BadRequestError } from '../../../utils/errors';

type TxOrPrisma = Prisma.TransactionClient | typeof prisma;

/**
 * Release expired holds.
 * Accepts an optional transaction client so this can be called atomically
 * inside a prisma.$transaction block.
 */
export const releaseExpiredHolds = async (
  now: Date,
  maSuatChieu?: string,
  tx: TxOrPrisma = prisma,
): Promise<{ count: number }> => {
  // 1. Find all expired held seats
  const expiredSeats = await tx.gheSuatChieu.findMany({
    where: {
      TrangThai: 'DANG_GIU',
      ThoiGianGiuGhe: { lt: now },
      ...(maSuatChieu && { MaSuatChieu: maSuatChieu }),
    },
    select: { MaGheSuatChieu: true },
  });

  if (expiredSeats.length === 0) {
    return { count: 0 };
  }

  const seatIds = expiredSeats.map((s) => s.MaGheSuatChieu);

  // 2. Find corresponding PhieuDatVe in CHO_THANH_TOAN status
  const bookingsToCancel = await tx.phieuDatVe.findMany({
    where: {
      TrangThai: 'CHO_THANH_TOAN',
      ChiTietDatVes: {
        some: { MaGheSuatChieu: { in: seatIds } },
      },
    },
    select: { MaPhieuDat: true },
  });

  if (bookingsToCancel.length > 0) {
    const bookingIds = bookingsToCancel.map((b) => b.MaPhieuDat);

    // 3. Update bookings to HET_HAN
    await tx.phieuDatVe.updateMany({
      where: { MaPhieuDat: { in: bookingIds } },
      data: { TrangThai: 'HET_HAN' },
    });

    // 4. Update transactions to THAT_BAI
    await tx.giaoDich.updateMany({
      where: {
        MaPhieuDat: { in: bookingIds },
        TrangThai: 'CHO_XU_LY',
      },
      data: { TrangThai: 'THAT_BAI' },
    });
  }

  // 5. Release seats back to TRONG
  return tx.gheSuatChieu.updateMany({
    where: { MaGheSuatChieu: { in: seatIds } },
    data: {
      TrangThai: 'TRONG',
      ThoiGianGiuGhe: null,
      MaTaiKhoanGiu: null,
    },
  });
};


/**
 * Hold seats transactionally with strict race condition prevention
 */
export const holdSeats = async (
  tx: any,
  maSuatChieu: string,
  maTaiKhoan: string,
  seatIds: string[],
  expireAt: Date,
  now: Date,
): Promise<void> => {
  const result = await tx.gheSuatChieu.updateMany({
    where: {
      MaGheSuatChieu: { in: seatIds },
      MaSuatChieu: maSuatChieu,
      KhaDung: true,
      OR: [
        { TrangThai: 'TRONG' },
        { TrangThai: 'DANG_GIU', ThoiGianGiuGhe: { lt: now } },
        { TrangThai: 'DANG_GIU', MaTaiKhoanGiu: maTaiKhoan },
      ],
    },
    data: {
      TrangThai: 'DANG_GIU',
      ThoiGianGiuGhe: expireAt,
      MaTaiKhoanGiu: maTaiKhoan,
    },
  });

  if (result.count !== seatIds.length) {
    throw new BadRequestError('Một hoặc nhiều ghế đã được đặt hoặc đang được giữ bởi người khác.');
  }
};

/**
 * Cancel held seats transactionally (must be owned by the caller)
 */
export const cancelHeldSeats = async (
  tx: any,
  maSuatChieu: string,
  maTaiKhoan: string,
  seatIds: string[],
): Promise<void> => {
  const result = await tx.gheSuatChieu.updateMany({
    where: {
      MaGheSuatChieu: { in: seatIds },
      MaSuatChieu: maSuatChieu,
      TrangThai: 'DANG_GIU',
      MaTaiKhoanGiu: maTaiKhoan,
    },
    data: {
      TrangThai: 'TRONG',
      ThoiGianGiuGhe: null,
      MaTaiKhoanGiu: null,
    },
  });

  if (result.count !== seatIds.length) {
    throw new BadRequestError('Một hoặc nhiều ghế không thuộc trạng thái đang giữ của bạn để hủy.');
  }
};
