import prisma from '../../../config/prisma';
import { payOS } from '../../../utils/payos.util';
import { env } from '../../../config/env';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import { identityQueries } from '../../identity';
import { assertPaymentGatewayAvailable } from '../gateway/paymentGateway.service';
import {
  generateVNPaySecureHash,
  normalizeIp,
  sortVNPayParams,
  stringifyVNPayParams,
  verifyVNPaySignature,
} from '../../../utils/vnpay.util';
import type { Prisma } from '@prisma/client';

const { findCustomerByAccountId } = identityQueries;

type PayosBooking = Prisma.PhieuDatVeGetPayload<{
  include: { ChiTietDatVes: { include: { GheSuatChieu: true } } };
}>;
type PayosTransaction = Prisma.GiaoDichGetPayload<Record<string, never>>;

const issuePayosLink = async (booking: PayosBooking, transaction: PayosTransaction) => {
  const amount = Number(booking.TongTien);
  let orderCode = 0;
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 10) {
    orderCode = Number(Date.now().toString().substring(3) + Math.floor(Math.random() * 1000));
    const existingTransaction = await prisma.giaoDich.findFirst({
      where: { MaGiaoDichNgoai: orderCode.toString() },
    });
    isUnique = !existingTransaction;
    attempts += 1;
  }
  if (!isUnique) {
    throw new BadRequestError('Không thể tạo mã đơn hàng duy nhất lúc này. Vui lòng thử lại.');
  }

  const payosResponse = await payOS.paymentRequests.create({
    orderCode,
    amount,
    description: `DAT VE PHIM ${booking.MaPhieuDat.substring(0, 8)}`.toUpperCase(),
    cancelUrl: env.PAYOS_CANCEL_URL,
    returnUrl: env.PAYOS_RETURN_URL,
    items: booking.ChiTietDatVes.map((detail) => ({
      name: `Ghe ${detail.MaGheSuatChieu.substring(0, 8)}`.toUpperCase(),
      quantity: 1,
      price: Number(detail.GiaVe),
    })),
  });

  await prisma.giaoDich.update({
    where: { MaGiaoDich: transaction.MaGiaoDich },
    data: { MaGiaoDichNgoai: orderCode.toString() },
  });

  return {
    checkoutUrl: payosResponse.checkoutUrl,
    qrCode: payosResponse.qrCode || null,
    orderCode: payosResponse.orderCode,
    maGiaoDich: transaction.MaGiaoDich,
    maPhieuDat: booking.MaPhieuDat,
    amount: payosResponse.amount,
    expiresAt: payosResponse.expiredAt || null,
  };
};

/**
 * Creates a PayOS payment link for a pending booking.
 */
export const createPayosLink = async (maPhieuDat: string, maTaiKhoan: string) => {
  await assertPaymentGatewayAvailable('PAYOS');
  const customer = await findCustomerByAccountId(maTaiKhoan);
  if (!customer) {
    throw new BadRequestError('Tài khoản không phải là khách hàng hợp lệ.');
  }

  // 1. Find the pending booking
  const booking = await prisma.phieuDatVe.findFirst({
    where: {
      MaPhieuDat: maPhieuDat,
      MaKhachHang: customer.MaKhachHang,
      KhaDung: true,
    },
    include: {
      ChiTietDatVes: {
        include: {
          GheSuatChieu: true,
        },
      },
    },
  });

  if (!booking) {
    throw new NotFoundError(`Không tìm thấy phiếu đặt vé với mã: ${maPhieuDat}`);
  }

  if (booking.TrangThai !== 'CHO_THANH_TOAN') {
    throw new BadRequestError(`Phiếu đặt vé không ở trạng thái chờ thanh toán (Trạng thái hiện tại: ${booking.TrangThai})`);
  }

  // 2. Verify seats are still held by the user and not expired
  const now = new Date();
  const isHeld = booking.ChiTietDatVes.every((ct) => {
    const seat = ct.GheSuatChieu;
    return (
      seat.TrangThai === 'DANG_GIU' &&
      seat.MaTaiKhoanGiu === maTaiKhoan &&
      seat.ThoiGianGiuGhe &&
      seat.ThoiGianGiuGhe >= now
    );
  });

  if (!isHeld) {
    throw new BadRequestError('Một số ghế trong phiếu đặt vé của bạn đã hết hạn giữ hoặc không thuộc sở hữu của bạn.');
  }

  // 3. Find the pending transaction
  const transaction = await prisma.giaoDich.findFirst({
    where: {
      MaPhieuDat: maPhieuDat,
      PhuongThuc: 'PAYOS',
      TrangThai: 'CHO_XU_LY',
      KhaDung: true,
    },
  });

  if (!transaction) {
    throw new NotFoundError('Không tìm thấy giao dịch chờ xử lý với phương thức PayOS cho phiếu đặt vé này.');
  }

  return issuePayosLink(booking, transaction);
};

export const createCounterPayosLink = async (maPhieuDat: string, adminAccountId: string) => {
  await assertPaymentGatewayAvailable('PAYOS');
  const booking = await prisma.phieuDatVe.findFirst({
    where: { MaPhieuDat: maPhieuDat, KenhDat: 'TAI_QUAY', MaKhachHang: null, KhaDung: true },
    include: { ChiTietDatVes: { include: { GheSuatChieu: true } } },
  });
  if (!booking) throw new NotFoundError('Không tìm thấy phiếu bán vé tại quầy.');
  if (booking.TrangThai !== 'CHO_THANH_TOAN') {
    throw new BadRequestError(`Phiếu đặt không còn chờ thanh toán (trạng thái: ${booking.TrangThai}).`);
  }

  const now = new Date();
  const isHeldByAdmin = booking.ChiTietDatVes.every(({ GheSuatChieu }) => (
    GheSuatChieu.TrangThai === 'DANG_GIU'
    && GheSuatChieu.MaTaiKhoanGiu === adminAccountId
    && Boolean(GheSuatChieu.ThoiGianGiuGhe)
    && GheSuatChieu.ThoiGianGiuGhe! >= now
  ));
  if (!isHeldByAdmin) {
    throw new BadRequestError('Ghế tại quầy đã hết hạn giữ hoặc không thuộc phiên Admin hiện tại.');
  }

  const transaction = await prisma.giaoDich.findFirst({
    where: { MaPhieuDat: maPhieuDat, PhuongThuc: 'PAYOS', TrangThai: 'CHO_XU_LY', KhaDung: true },
  });
  if (!transaction) throw new NotFoundError('Không tìm thấy giao dịch PayOS tại quầy đang chờ xử lý.');
  return issuePayosLink(booking, transaction);
};

/**
 * Handles Webhook callbacks from PayOS.
 */
export const handleWebhook = async (webhookBody: any) => {
  if (!webhookBody || !webhookBody.signature || !webhookBody.data) {
    throw new BadRequestError('Webhook payload không hợp lệ.');
  }

  // 1. Verify webhook signature
  let verifiedData;
  try {
    verifiedData = await payOS.webhooks.verify(webhookBody);
  } catch (error) {
    throw new BadRequestError('Chữ ký webhook không hợp lệ.');
  }

  const orderCode = verifiedData.orderCode;

  // Handle test confirmation webhook
  if (verifiedData.description === 'confirm-webhook' || orderCode === 123) {
    return { success: true, message: 'Webhook confirm event success' };
  }

  // 2. Find transaction in our DB
  const transaction = await prisma.giaoDich.findFirst({
    where: {
      MaGiaoDichNgoai: orderCode.toString(),
      KhaDung: true,
    },
    include: {
      PhieuDatVe: {
        include: {
          ChiTietDatVes: true,
        },
      },
    },
  });

  if (!transaction) {
    console.warn(`[PayOS Webhook] Không tìm thấy giao dịch cho orderCode: ${orderCode}`);
    return { success: true, message: 'Transaction not found, acknowledged' };
  }

  // 3. Webhook idempotency check
  if (transaction.TrangThai !== 'CHO_XU_LY') {
    return { success: true, message: 'Transaction already processed' };
  }

  const isPaid = verifiedData.code === '00';

  if (isPaid) {
    await prisma.$transaction(async (tx) => {
      // Re-verify inside tx
      const currentTx = await tx.giaoDich.findUnique({
        where: { MaGiaoDich: transaction.MaGiaoDich },
      });
      if (!currentTx || currentTx.TrangThai !== 'CHO_XU_LY') return;

      // Update transaction status
      await tx.giaoDich.update({
        where: { MaGiaoDich: transaction.MaGiaoDich },
        data: {
          TrangThai: 'THANH_CONG',
          NgayGiaoDich: new Date(),
        },
      });

      // Update booking status
      await tx.phieuDatVe.update({
        where: { MaPhieuDat: transaction.MaPhieuDat },
        data: { TrangThai: 'DA_THANH_TOAN' },
      });

      // Convert seats to DA_DAT
      const seatIds = transaction.PhieuDatVe.ChiTietDatVes.map((ct) => ct.MaGheSuatChieu);
      await tx.gheSuatChieu.updateMany({
        where: { MaGheSuatChieu: { in: seatIds } },
        data: {
          TrangThai: 'DA_DAT',
          ThoiGianGiuGhe: null,
          MaTaiKhoanGiu: null,
        },
      });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      // Re-verify inside tx
      const currentTx = await tx.giaoDich.findUnique({
        where: { MaGiaoDich: transaction.MaGiaoDich },
      });
      if (!currentTx || currentTx.TrangThai !== 'CHO_XU_LY') return;

      // Update transaction status
      await tx.giaoDich.update({
        where: { MaGiaoDich: transaction.MaGiaoDich },
        data: { TrangThai: 'THAT_BAI' },
      });

      // Update booking status
      await tx.phieuDatVe.update({
        where: { MaPhieuDat: transaction.MaPhieuDat },
        data: { TrangThai: 'DA_HUY' },
      });

      // Release seats back to TRONG only if they are still held (not DA_DAT)
      const seatIds = transaction.PhieuDatVe.ChiTietDatVes.map((ct) => ct.MaGheSuatChieu);
      await tx.gheSuatChieu.updateMany({
        where: {
          MaGheSuatChieu: { in: seatIds },
          TrangThai: 'DANG_GIU',
        },
        data: {
          TrangThai: 'TRONG',
          ThoiGianGiuGhe: null,
          MaTaiKhoanGiu: null,
        },
      });
    });
  }

  return { success: true, message: 'Processed successfully' };
};

/**
 * Checks transaction status and polls PayOS API for synchronization if pending.
 */
export const checkPaymentStatus = async (maGiaoDich: string, maTaiKhoan: string, allowCounterSale = false) => {
  const customer = allowCounterSale ? null : await findCustomerByAccountId(maTaiKhoan);
  if (!allowCounterSale && !customer) throw new BadRequestError('Tài khoản không phải là khách hàng hợp lệ.');

  // Find transaction
  const transaction = await prisma.giaoDich.findFirst({
    where: {
      OR: [
        { MaGiaoDich: maGiaoDich },
        { MaGiaoDichNgoai: maGiaoDich },
        { MaPhieuDat: maGiaoDich },
      ],
      KhaDung: true,
    },
    include: {
      PhieuDatVe: {
        include: {
          KhachHang: true,
          ChiTietDatVes: true,
        },
      },
    },
  });

  if (!transaction) {
    throw new NotFoundError('Không tìm thấy giao dịch.');
  }

  const canView = allowCounterSale
    ? transaction.PhieuDatVe.KenhDat === 'TAI_QUAY'
    : transaction.PhieuDatVe.KhachHang?.MaTaiKhoan === maTaiKhoan;
  if (!canView) {
    throw new BadRequestError('Bạn không có quyền xem thông tin giao dịch này.');
  }

  // Poll PayOS API for updates if status is CHO_XU_LY
  if (transaction.TrangThai === 'CHO_XU_LY' && transaction.MaGiaoDichNgoai) {
    try {
      const orderCode = Number(transaction.MaGiaoDichNgoai);
      const payosLink = await payOS.paymentRequests.get(orderCode);

      if (payosLink.status === 'PAID') {
        await prisma.$transaction(async (tx) => {
          const currentTx = await tx.giaoDich.findUnique({
            where: { MaGiaoDich: transaction.MaGiaoDich },
          });
          if (!currentTx || currentTx.TrangThai !== 'CHO_XU_LY') return;

          await tx.giaoDich.update({
            where: { MaGiaoDich: transaction.MaGiaoDich },
            data: {
              TrangThai: 'THANH_CONG',
              NgayGiaoDich: new Date(),
            },
          });

          await tx.phieuDatVe.update({
            where: { MaPhieuDat: transaction.MaPhieuDat },
            data: { TrangThai: 'DA_THANH_TOAN' },
          });

          const seatIds = transaction.PhieuDatVe.ChiTietDatVes.map((ct) => ct.MaGheSuatChieu);
          await tx.gheSuatChieu.updateMany({
            where: { MaGheSuatChieu: { in: seatIds } },
            data: {
              TrangThai: 'DA_DAT',
              ThoiGianGiuGhe: null,
              MaTaiKhoanGiu: null,
            },
          });
        });

        transaction.TrangThai = 'THANH_CONG';
        transaction.PhieuDatVe.TrangThai = 'DA_THANH_TOAN';
      } else if (['CANCELLED', 'EXPIRED', 'FAILED'].includes(payosLink.status)) {
        await prisma.$transaction(async (tx) => {
          const currentTx = await tx.giaoDich.findUnique({
            where: { MaGiaoDich: transaction.MaGiaoDich },
          });
          if (!currentTx || currentTx.TrangThai !== 'CHO_XU_LY') return;

          await tx.giaoDich.update({
            where: { MaGiaoDich: transaction.MaGiaoDich },
            data: { TrangThai: 'THAT_BAI' },
          });

          await tx.phieuDatVe.update({
            where: { MaPhieuDat: transaction.MaPhieuDat },
            data: { TrangThai: 'DA_HUY' },
          });

          const seatIds = transaction.PhieuDatVe.ChiTietDatVes.map((ct) => ct.MaGheSuatChieu);
          await tx.gheSuatChieu.updateMany({
            where: {
              MaGheSuatChieu: { in: seatIds },
              TrangThai: 'DANG_GIU',
            },
            data: {
              TrangThai: 'TRONG',
              ThoiGianGiuGhe: null,
              MaTaiKhoanGiu: null,
            },
          });
        });

        transaction.TrangThai = 'THAT_BAI';
        transaction.PhieuDatVe.TrangThai = 'DA_HUY';
      }
    } catch (err) {
      console.error('[Sync Status checkPaymentStatus] Lỗi khi đồng bộ từ PayOS API:', err);
    }
  }

  return {
    maGiaoDich: transaction.MaGiaoDich,
    maPhieuDat: transaction.MaPhieuDat,
    trangThaiGiaoDich: transaction.TrangThai,
    trangThaiPhieuDatVe: transaction.PhieuDatVe.TrangThai,
    phuongThuc: transaction.PhuongThuc,
    soTien: Number(transaction.SoTien),
    ngayGiaoDich: transaction.NgayGiaoDich,
    orderCode: transaction.MaGiaoDichNgoai ? Number(transaction.MaGiaoDichNgoai) : null,
  };
};

const formatVNPayDate = (date: Date): string => {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
};

/**
 * Creates a signed VNPay Sandbox payment URL for a pending booking.
 */
export const createVnpayLink = async (
  maPhieuDat: string,
  maTaiKhoan: string,
  clientIp: string,
) => {
  await assertPaymentGatewayAvailable('VNPAY');
  const customer = await findCustomerByAccountId(maTaiKhoan);
  if (!customer) {
    throw new BadRequestError('Tài khoản không phải là khách hàng hợp lệ.');
  }

  const booking = await prisma.phieuDatVe.findFirst({
    where: {
      MaPhieuDat: maPhieuDat,
      MaKhachHang: customer.MaKhachHang,
      KhaDung: true,
    },
    include: {
      ChiTietDatVes: { include: { GheSuatChieu: true } },
    },
  });

  if (!booking) {
    throw new NotFoundError(`Không tìm thấy phiếu đặt vé với mã: ${maPhieuDat}`);
  }
  if (booking.TrangThai !== 'CHO_THANH_TOAN') {
    throw new BadRequestError(`Phiếu đặt vé không ở trạng thái chờ thanh toán (Trạng thái hiện tại: ${booking.TrangThai})`);
  }

  const now = new Date();
  const seatsAreHeld = booking.ChiTietDatVes.every(({ GheSuatChieu }) => (
    GheSuatChieu.TrangThai === 'DANG_GIU'
    && GheSuatChieu.MaTaiKhoanGiu === maTaiKhoan
    && Boolean(GheSuatChieu.ThoiGianGiuGhe)
    && GheSuatChieu.ThoiGianGiuGhe! >= now
  ));
  if (!seatsAreHeld) {
    throw new BadRequestError('Một số ghế đã hết hạn giữ hoặc không thuộc sở hữu của bạn.');
  }

  const transaction = await prisma.giaoDich.findFirst({
    where: {
      MaPhieuDat: maPhieuDat,
      PhuongThuc: 'VNPAY',
      TrangThai: 'CHO_XU_LY',
      KhaDung: true,
    },
  });
  if (!transaction) {
    throw new NotFoundError('Không tìm thấy giao dịch VNPay đang chờ xử lý.');
  }

  const transactionReference = transaction.MaGiaoDich;
  await prisma.giaoDich.update({
    where: { MaGiaoDich: transaction.MaGiaoDich },
    data: { MaGiaoDichNgoai: transactionReference },
  });

  const expiresAt = new Date(Math.min(
    ...booking.ChiTietDatVes.map(({ GheSuatChieu }) =>
      GheSuatChieu.ThoiGianGiuGhe!.getTime()),
  ));
  const vnpayParams: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: env.VNPAY_TMN_CODE,
    vnp_Amount: Math.round(Number(booking.TongTien) * 100).toString(),
    vnp_CreateDate: formatVNPayDate(now),
    vnp_ExpireDate: formatVNPayDate(expiresAt),
    vnp_CurrCode: 'VND',
    vnp_IpAddr: normalizeIp(clientIp),
    vnp_Locale: 'vn',
    vnp_OrderInfo: `Thanh toan phieu dat ve ${maPhieuDat}`.substring(0, 100),
    vnp_OrderType: 'other',
    vnp_ReturnUrl: env.VNPAY_CALLBACK_URL
      || `${env.BACKEND_PUBLIC_URL}${env.API_PREFIX}/payment/vnpay/return`,
    vnp_TxnRef: transactionReference,
  };
  const sortedParams = sortVNPayParams(vnpayParams);
  sortedParams.vnp_SecureHash = generateVNPaySecureHash(vnpayParams, env.VNPAY_HASH_SECRET);

  return {
    paymentUrl: `${env.VNPAY_PAYMENT_URL}?${stringifyVNPayParams(sortedParams)}`,
    maGiaoDich: transaction.MaGiaoDich,
    maPhieuDat,
    amount: Number(booking.TongTien),
    expiresAt,
  };
};

/**
 * Applies an authenticated VNPay IPN notification exactly once.
 */
export const handleVnpayIpn = async (queryParams: Record<string, unknown>) => {
  if (!verifyVNPaySignature(queryParams, env.VNPAY_HASH_SECRET)) {
    return { RspCode: '97', Message: 'Invalid signature' };
  }

  const transactionReference = typeof queryParams.vnp_TxnRef === 'string'
    ? queryParams.vnp_TxnRef
    : '';
  const receivedAmount = typeof queryParams.vnp_Amount === 'string'
    ? Number(queryParams.vnp_Amount)
    : Number.NaN;
  if (!transactionReference || !Number.isFinite(receivedAmount)) {
    return { RspCode: '99', Message: 'Input required data missing' };
  }

  const transaction = await prisma.giaoDich.findFirst({
    where: {
      OR: [
        { MaGiaoDich: transactionReference },
        { MaGiaoDichNgoai: transactionReference },
      ],
      PhuongThuc: 'VNPAY',
      KhaDung: true,
    },
    include: {
      PhieuDatVe: { include: { ChiTietDatVes: true } },
    },
  });
  if (!transaction) return { RspCode: '01', Message: 'Order not found' };

  const expectedAmount = Math.round(Number(transaction.SoTien) * 100);
  if (Math.round(receivedAmount) !== expectedAmount) {
    return { RspCode: '04', Message: 'Invalid amount' };
  }
  if (transaction.TrangThai !== 'CHO_XU_LY') {
    return { RspCode: '02', Message: 'Order already confirmed' };
  }

  const isSuccess = queryParams.vnp_ResponseCode === '00'
    && queryParams.vnp_TransactionStatus === '00';
  const seatIds = transaction.PhieuDatVe.ChiTietDatVes.map((item) => item.MaGheSuatChieu);

  await prisma.$transaction(async (tx) => {
    const currentTransaction = await tx.giaoDich.findUnique({
      where: { MaGiaoDich: transaction.MaGiaoDich },
    });
    if (!currentTransaction || currentTransaction.TrangThai !== 'CHO_XU_LY') return;

    await tx.giaoDich.update({
      where: { MaGiaoDich: transaction.MaGiaoDich },
      data: {
        TrangThai: isSuccess ? 'THANH_CONG' : 'THAT_BAI',
        NgayGiaoDich: isSuccess ? new Date() : transaction.NgayGiaoDich,
      },
    });
    await tx.phieuDatVe.update({
      where: { MaPhieuDat: transaction.MaPhieuDat },
      data: { TrangThai: isSuccess ? 'DA_THANH_TOAN' : 'DA_HUY' },
    });
    await tx.gheSuatChieu.updateMany({
      where: isSuccess
        ? { MaGheSuatChieu: { in: seatIds } }
        : { MaGheSuatChieu: { in: seatIds }, TrangThai: 'DANG_GIU' },
      data: {
        TrangThai: isSuccess ? 'DA_DAT' : 'TRONG',
        ThoiGianGiuGhe: null,
        MaTaiKhoanGiu: null,
      },
    });
  });

  return { RspCode: '00', Message: 'Confirm Success' };
};

export const checkVnpayStatus = async (maGiaoDich: string, maTaiKhoan: string) => {
  const customer = await findCustomerByAccountId(maTaiKhoan);
  if (!customer) {
    throw new BadRequestError('Tài khoản không phải là khách hàng hợp lệ.');
  }

  const transaction = await prisma.giaoDich.findFirst({
    where: {
      OR: [
        { MaGiaoDich: maGiaoDich },
        { MaGiaoDichNgoai: maGiaoDich },
        { MaPhieuDat: maGiaoDich },
      ],
      PhuongThuc: 'VNPAY',
      KhaDung: true,
    },
    include: { PhieuDatVe: { include: { KhachHang: true } } },
  });
  if (!transaction) throw new NotFoundError('Không tìm thấy giao dịch VNPay.');
  if (transaction.PhieuDatVe.KhachHang?.MaTaiKhoan !== maTaiKhoan) {
    throw new BadRequestError('Bạn không có quyền xem thông tin giao dịch này.');
  }

  return {
    status: transaction.TrangThai,
    bookingStatus: transaction.PhieuDatVe.TrangThai,
    amount: Number(transaction.SoTien),
    maGiaoDich: transaction.MaGiaoDich,
    maPhieuDat: transaction.MaPhieuDat,
  };
};

export const checkCounterPayosStatus = (maGiaoDich: string) =>
  checkPaymentStatus(maGiaoDich, '', true);
