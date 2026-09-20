import prisma from '../config/prisma';
import { payOS } from '../utils/payos.util';
import { env } from '../config/env';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { findCustomerByAccountId } from '../repositories/datve.repository';
import { generateVNPaySecureHash, verifyVNPaySignature, sortObject, stringifyVNPayParams, normalizeIp } from '../utils/vnpay.util';
import qs from 'qs';
import { assertPaymentGatewayAvailable } from './paymentGateway.service';

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

  const amount = Number(booking.TongTien);

  // 4. Generate unique integer orderCode and verify uniqueness in DB
  let orderCode = 0;
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 10) {
    orderCode = Number(Date.now().toString().substring(3) + Math.floor(Math.random() * 1000));
    const existingTx = await prisma.giaoDich.findFirst({
      where: { MaGiaoDichNgoai: orderCode.toString() },
    });
    if (!existingTx) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new BadRequestError('Không thể tạo mã đơn hàng duy nhất lúc này. Vui lòng thử lại.');
  }

  // 5. Build items for PayOS
  const items = booking.ChiTietDatVes.map((ct) => ({
    name: `Ghe ${ct.MaGheSuatChieu.substring(0, 8)}`.toUpperCase(),
    quantity: 1,
    price: Number(ct.GiaVe),
  }));

  // 6. Call PayOS API to generate link
  const payosResponse = await payOS.paymentRequests.create({
    orderCode,
    amount,
    description: `DAT VE PHIM ${maPhieuDat.substring(0, 8)}`.toUpperCase(),
    cancelUrl: env.PAYOS_CANCEL_URL,
    returnUrl: env.PAYOS_RETURN_URL,
    items,
  });

  // 7. Update transaction record with the orderCode
  await prisma.giaoDich.update({
    where: { MaGiaoDich: transaction.MaGiaoDich },
    data: {
      MaGiaoDichNgoai: orderCode.toString(),
    },
  });

  return {
    checkoutUrl: payosResponse.checkoutUrl,
    qrCode: payosResponse.qrCode || null,
    orderCode: payosResponse.orderCode,
    maGiaoDich: transaction.MaGiaoDich,
    maPhieuDat: maPhieuDat,
    amount: payosResponse.amount,
    expiresAt: payosResponse.expiredAt || null,
  };
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
export const checkPaymentStatus = async (maGiaoDich: string, maTaiKhoan: string) => {
  const customer = await findCustomerByAccountId(maTaiKhoan);
  if (!customer) {
    throw new BadRequestError('Tài khoản không phải là khách hàng hợp lệ.');
  }

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

  // Verify only customer owner can query
  if (transaction.PhieuDatVe.KhachHang?.MaTaiKhoan !== maTaiKhoan) {
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

/**
 * Helper to format Date to yyyyMMddHHmmss
 */
function formatVNPayDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
}

/**
 * Creates a VNPay payment link for a pending booking.
 */
export const createVnpayLink = async (
  maPhieuDat: string,
  maTaiKhoan: string,
  clientIp: string
) => {
  await assertPaymentGatewayAvailable('VNPAY');
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
      PhuongThuc: 'VNPAY',
      TrangThai: 'CHO_XU_LY',
      KhaDung: true,
    },
  });

  if (!transaction) {
    throw new NotFoundError('Không tìm thấy giao dịch chờ xử lý với phương thức VNPAY cho phiếu đặt vé này.');
  }

  const amount = Number(booking.TongTien);

  // 4. Update the external transaction ID (MaGiaoDichNgoai) to be the transaction UUID (MaGiaoDich)
  const vnpTxnRef = transaction.MaGiaoDich;
  await prisma.giaoDich.update({
    where: { MaGiaoDich: transaction.MaGiaoDich },
    data: {
      MaGiaoDichNgoai: vnpTxnRef,
    },
  });

  // 5. Build VNPay request parameters
  const createDate = formatVNPayDate(new Date());
  
  const vnpParams: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: env.VNPAY_TMN_CODE,
    vnp_Amount: Math.round(amount * 100).toString(),
    vnp_CreateDate: createDate,
    vnp_CurrCode: 'VND',
    vnp_IpAddr: normalizeIp(clientIp),
    vnp_Locale: 'vn',
    vnp_OrderInfo: `Thanh toan phieu dat ve ${maPhieuDat}`.substring(0, 100),
    vnp_OrderType: 'billpayment',
    vnp_ReturnUrl: env.VNPAY_CALLBACK_URL || `${env.BACKEND_PUBLIC_URL}${env.API_PREFIX}/payment/vnpay/return`,
    vnp_TxnRef: vnpTxnRef,
  };

  // 6. Generate the secure hash and payment URL
  const sortedParams = sortObject(vnpParams);
  const signData = qs.stringify(sortedParams, { encode: false });
  const secureHash = generateVNPaySecureHash(vnpParams, env.VNPAY_HASH_SECRET);
  
  // Append vnp_SecureHash to sortedParams
  (sortedParams as any).vnp_SecureHash = secureHash;
  
  const paymentUrl = `${env.VNPAY_PAYMENT_URL}?${qs.stringify(sortedParams, { encode: false })}`;

  // Print debug values as requested
  console.log("SIGN DATA:", signData);
  console.log("PAYMENT URL:", paymentUrl);

  return {
    paymentUrl,
    maGiaoDich: transaction.MaGiaoDich,
    maPhieuDat: maPhieuDat,
    amount,
    vnpTxnRef,
  };
};

/**
 * Handles IPN callbacks from VNPay.
 */
export const handleVnpayIpn = async (queryParams: any) => {
  // 1. Verify secure hash
  const isValidSignature = verifyVNPaySignature(queryParams, env.VNPAY_HASH_SECRET);
  if (!isValidSignature) {
    return { RspCode: '97', Message: 'Invalid signature' };
  }

  const vnp_TxnRef = queryParams.vnp_TxnRef;
  const vnp_Amount = queryParams.vnp_Amount;
  const vnp_ResponseCode = queryParams.vnp_ResponseCode;
  const vnp_TransactionStatus = queryParams.vnp_TransactionStatus;

  if (!vnp_TxnRef) {
    return { RspCode: '99', Message: 'Input required data missing' };
  }

  // 2. Find transaction
  const transaction = await prisma.giaoDich.findFirst({
    where: {
      OR: [
        { MaGiaoDich: vnp_TxnRef },
        { MaGiaoDichNgoai: vnp_TxnRef },
      ],
      PhuongThuc: 'VNPAY',
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
    return { RspCode: '01', Message: 'Order not found' };
  }

  // 3. Verify amount
  // vnp_Amount is multiplied by 100 from actual currency
  const expectedAmountCent = Math.round(Number(transaction.SoTien) * 100);
  if (Math.round(Number(vnp_Amount)) !== expectedAmountCent) {
    return { RspCode: '04', Message: 'Invalid amount' };
  }

  // 4. Check if transaction has already been processed
  if (transaction.TrangThai !== 'CHO_XU_LY') {
    return { RspCode: '02', Message: 'Order already confirmed' };
  }

  // 5. Update status in database transaction
  const isSuccess = vnp_ResponseCode === '00' && vnp_TransactionStatus === '00';

  if (isSuccess) {
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

  return { RspCode: '00', Message: 'Confirm Success' };
};

/**
 * Checks transaction status of a VNPay transaction in our DB.
 */
export const checkVnpayStatus = async (maGiaoDich: string, maTaiKhoan: string) => {
  const customer = await findCustomerByAccountId(maTaiKhoan);
  if (!customer) {
    throw new BadRequestError('Tài khoản không phải là khách hàng hợp lệ.');
  }

  // Find transaction
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
    include: {
      PhieuDatVe: {
        include: {
          KhachHang: true,
        },
      },
    },
  });

  if (!transaction) {
    throw new NotFoundError('Không tìm thấy giao dịch.');
  }

  // Verify only customer owner can query
  if (transaction.PhieuDatVe.KhachHang?.MaTaiKhoan !== maTaiKhoan) {
    throw new BadRequestError('Bạn không có quyền xem thông tin giao dịch này.');
  }

  return {
    status: transaction.TrangThai,
    bookingStatus: transaction.PhieuDatVe.TrangThai,
    amount: Number(transaction.SoTien),
    maGiaoDich: transaction.MaGiaoDich,
    maPhieuDat: transaction.MaPhieuDat,
    vnpTxnRef: transaction.MaGiaoDichNgoai || transaction.MaGiaoDich,
  };
};
