import { Prisma } from '@prisma/client';
import { BadRequestError } from '../utils/errors';

/** Serialize both admin refund entry points on the same transaction row. */
export const claimRefundTransaction = async (tx: Prisma.TransactionClient, id: string) => {
  const result = await tx.giaoDich.updateMany({
    where: { MaGiaoDich: id, TrangThai: 'THANH_CONG', KhaDung: true },
    data: { TrangThai: 'DA_HOAN_TIEN' },
  });
  if (result.count !== 1) {
    throw new BadRequestError('Giao dịch không ở trạng thái thành công hoặc đã được hoàn tiền');
  }
};

/** Records a manual refund. No bank/provider money transfer happens here. */
export const cancelRefundedBooking = async (tx: Prisma.TransactionClient, bookingId: string) => {
  await tx.phieuDatVe.update({ where: { MaPhieuDat: bookingId }, data: { TrangThai: 'DA_HUY' } });
  // Old cancelled tickets stay in history; they must not release a newer reservation.
  await tx.gheSuatChieu.updateMany({
    where: {
      TrangThai: 'DA_DAT',
      ChiTietDatVes: {
        some: { MaPhieuDat: bookingId },
        none: {
          MaPhieuDat: { not: bookingId },
          KhaDung: true,
          PhieuDatVe: { KhaDung: true, TrangThai: { in: ['CHO_THANH_TOAN', 'DA_THANH_TOAN'] } },
        },
      },
    },
    data: { TrangThai: 'TRONG', ThoiGianGiuGhe: null, MaTaiKhoanGiu: null },
  });
};
