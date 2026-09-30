import prisma from '../../../config/prisma';
import { seatHoldOperations } from '../../showtime';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import { combineShowtimeDateTime } from '../../../utils/showtimeDateTime';
import { calculateSeatPrice, formatSeatLabel } from '../../../utils/seatPricing';
import { operationalSettings } from '../../operational-settings';
import { milliseconds } from '../../../shared/time';
import { identityQueries } from '../../identity';

const { holdSeats, cancelHeldSeats, releaseExpiredHolds } = seatHoldOperations;
import {
  findHeldSeatsForPayment,
  createPaidBookingTransaction,
  releaseHeldSeats,
  findBookingForCustomer,
  cancelBooking,
  createRefundRequest,
  findPendingRefundRequest,
  findSuccessfulTransactionByBooking,
  createPendingBookingTransaction,
} from './datve.repository';

const { findCustomerByAccountId } = identityQueries;

/**
 * Hold seats according to the current operational policy.
 */
export const giuGhe = async (
  maSuatChieu: string,
  seatIds: string[],
  maTaiKhoan: string,
) => {
  const settings = await operationalSettings.get();
  const now = new Date();
  
  // 1. Fetch showtime to validate existence and start time
  const sc = await prisma.suatChieu.findFirst({
    where: { MaSuatChieu: maSuatChieu, KhaDung: true },
  });

  if (!sc) {
    throw new NotFoundError(`Không tìm thấy suất chiếu với mã: ${maSuatChieu}`);
  }

  // Combine NgayChieu and GioChieu to get combined showtime start DateTime
  const showtimeStart = combineShowtimeDateTime(sc.NgayChieu, sc.GioChieu);

  if (showtimeStart <= now) {
    throw new BadRequestError('Suất chiếu đã bắt đầu, không thể giữ ghế.');
  }

  // Deduplicate seat IDs
  const uniqueSeatIds = Array.from(new Set(seatIds));
  const expireAt = new Date(
    now.getTime() + milliseconds.minutes(settings.ThoiGianGiuGhePhut),
  );

  // 2. Execute transaction
  return prisma.$transaction(async (tx) => {
    // Release expired holds for this showtime first (inside tx for consistency)
    await releaseExpiredHolds(now, maSuatChieu, tx);

    // Call repository to execute conditional updates
    await holdSeats(tx, maSuatChieu, maTaiKhoan, uniqueSeatIds, expireAt, now);

    // Fetch the updated seats
    const updatedSeats = await tx.gheSuatChieu.findMany({
      where: {
        MaGheSuatChieu: { in: uniqueSeatIds },
        MaSuatChieu: maSuatChieu,
      },
      select: {
        MaGheSuatChieu: true,
        TrangThai: true,
        ThoiGianGiuGhe: true,
      },
    });

    return {
      MaSuatChieu: maSuatChieu,
      ThoiGianHetHan: expireAt,
      DanhSachGhe: updatedSeats.map((s) => ({
        MaGheSuatChieu: s.MaGheSuatChieu,
        TrangThai: s.TrangThai,
        ThoiGianGiuGhe: s.ThoiGianGiuGhe,
      })),
    };
  });
};

/**
 * Service to cancel held seats manually
 */
export const huyGiuGhe = async (
  maSuatChieu: string,
  seatIds: string[],
  maTaiKhoan: string,
) => {
  const now = new Date();

  // Deduplicate seat IDs
  const uniqueSeatIds = Array.from(new Set(seatIds));

  // Execute transaction
  return prisma.$transaction(async (tx) => {
    // Release expired holds for this showtime first (inside tx for consistency)
    await releaseExpiredHolds(now, maSuatChieu, tx);

    // Call repository to release user's held seats
    await cancelHeldSeats(tx, maSuatChieu, maTaiKhoan, uniqueSeatIds);

    // Fetch the updated seats
    const updatedSeats = await tx.gheSuatChieu.findMany({
      where: {
        MaGheSuatChieu: { in: uniqueSeatIds },
        MaSuatChieu: maSuatChieu,
      },
      select: {
        MaGheSuatChieu: true,
        TrangThai: true,
      },
    });

    return {
      MaSuatChieu: maSuatChieu,
      DanhSachGhe: updatedSeats.map((s) => ({
        MaGheSuatChieu: s.MaGheSuatChieu,
        TrangThai: s.TrangThai,
      })),
    };
  });
};

// ==================================================
// 1. POST /api/v1/dat-ve/thanh-toan-gia-lap
// ==================================================

export const thanhToanGiaLap = async (
  maSuatChieu: string,
  seatIds: string[],
  phuongThuc: 'TIEN_MAT',
  ketQua: 'THANH_CONG' | 'THAT_BAI',
  maTaiKhoan: string,
) => {
  const now = new Date();

  // 1. Find the customer associated with the account
  const customer = await findCustomerByAccountId(maTaiKhoan);
  if (!customer) {
    throw new BadRequestError('Tài khoản không phải là khách hàng hợp lệ.');
  }

  // 2. Fetch the seats that are held by the user and not expired
  const heldSeats = await findHeldSeatsForPayment(maSuatChieu, seatIds, maTaiKhoan, now);
  if (heldSeats.length !== seatIds.length) {
    throw new BadRequestError('Một hoặc nhiều ghế đã hết hạn giữ hoặc không thuộc quyền sở hữu của bạn.');
  }

  // 3. Verify showtime has not started yet
  const firstSeat = heldSeats[0];
  const sc = firstSeat.SuatChieu;
  const showtimeStart = combineShowtimeDateTime(sc.NgayChieu, sc.GioChieu);

  if (showtimeStart <= now) {
    throw new BadRequestError('Suất chiếu đã bắt đầu, không thể thực hiện thanh toán.');
  }

  // 4. Calculate prices
  let totalAmount = 0;
  const seatPrices = heldSeats.map((s) => {
    const basePrice = Number(s.SuatChieu.GiaVeGoc);
    const roomSurcharge = Number(s.SuatChieu.PhongChieu.LoaiPhong.PhuThu);
    const daySurcharge = Number(s.SuatChieu.LoaiNgay.PhuThu);
    const seatSurcharge = Number(s.Ghe.LoaiGhe.PhuThu);
    const price = calculateSeatPrice(basePrice, roomSurcharge, daySurcharge, seatSurcharge, s.Ghe.SucChua);
    totalAmount += price;
    return {
      maGheSuatChieu: s.MaGheSuatChieu,
      price,
      tenGhe: formatSeatLabel(s.Ghe.ViTriDay, s.Ghe.ViTriCot, s.Ghe.DoRongCot),
    };
  });

  // 5. Handle success or failure scenario
  if (ketQua === 'THAT_BAI') {
    // Release seats in transaction
    await prisma.$transaction(async (tx) => {
      await releaseHeldSeats(tx, maSuatChieu, seatIds, maTaiKhoan);
    });
    return {
      success: false,
      message: 'Thanh toán giả lập thất bại. Ghế giữ đã được giải phóng.',
    };
  }

  // Generate partner reference code
  const maThamChieuDoiTac = `REF_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  // Create booking
  const result = await createPaidBookingTransaction(
    customer.MaKhachHang,
    maSuatChieu,
    seatIds,
    phuongThuc,
    maThamChieuDoiTac,
    totalAmount,
    seatPrices,
    maTaiKhoan,
  );

  return {
    success: true,
    message: 'Thanh toán thành công',
    data: {
      MaPhieuDat: result.phieuDatVe.MaPhieuDat,
      TongTien: totalAmount,
      TrangThai: result.phieuDatVe.TrangThai,
      NgayTao: result.phieuDatVe.NgayTao,
      QRPayload: `QR_${result.phieuDatVe.MaPhieuDat}`,
      DanhSachGhe: seatPrices.map((sp) => ({
        MaGheSuatChieu: sp.maGheSuatChieu,
        TenGhe: sp.tenGhe,
        GiaVe: sp.price,
      })),
    },
  };
};

// ==================================================
// 2. POST /api/v1/dat-ve/thanh-toan
// ==================================================

export const thanhToan = async (
  maSuatChieu: string,
  seatIds: string[],
  phuongThuc: 'VNPAY' | 'TIEN_MAT' | 'PAYOS',
  maTaiKhoan: string,
) => {
  if (phuongThuc === 'PAYOS' || phuongThuc === 'VNPAY') {
    const now = new Date();

    // 1. Find the customer associated with the account
    const customer = await findCustomerByAccountId(maTaiKhoan);
    if (!customer) {
      throw new BadRequestError('Tài khoản không phải là khách hàng hợp lệ.');
    }

    // 2. Fetch the seats that are held by the user and not expired
    const heldSeats = await findHeldSeatsForPayment(maSuatChieu, seatIds, maTaiKhoan, now);
    if (heldSeats.length !== seatIds.length) {
      throw new BadRequestError('Một hoặc nhiều ghế đã hết hạn giữ hoặc không thuộc quyền sở hữu của bạn.');
    }

    // 3. Verify showtime has not started yet
    const firstSeat = heldSeats[0];
    const sc = firstSeat.SuatChieu;
    const showtimeStart = combineShowtimeDateTime(sc.NgayChieu, sc.GioChieu);

    if (showtimeStart <= now) {
      throw new BadRequestError('Suất chiếu đã bắt đầu, không thể thực hiện thanh toán.');
    }

    // 4. Calculate prices
    let totalAmount = 0;
    const seatPrices = heldSeats.map((s) => {
      const basePrice = Number(s.SuatChieu.GiaVeGoc);
      const roomSurcharge = Number(s.SuatChieu.PhongChieu.LoaiPhong.PhuThu);
      const daySurcharge = Number(s.SuatChieu.LoaiNgay.PhuThu);
      const seatSurcharge = Number(s.Ghe.LoaiGhe.PhuThu);
      const price = calculateSeatPrice(basePrice, roomSurcharge, daySurcharge, seatSurcharge, s.Ghe.SucChua);
      totalAmount += price;
      return {
        maGheSuatChieu: s.MaGheSuatChieu,
        price,
        tenGhe: formatSeatLabel(s.Ghe.ViTriDay, s.Ghe.ViTriCot, s.Ghe.DoRongCot),
      };
    });

    // 5. Create pending booking and refresh the hold using the current policy.
    const settings = await operationalSettings.get();
    const paymentExpiresAt = new Date(
      now.getTime() + milliseconds.minutes(settings.ThoiGianGiuGhePhut),
    );
    const result = await createPendingBookingTransaction(
      customer.MaKhachHang,
      maSuatChieu,
      seatIds,
      phuongThuc,
      totalAmount,
      seatPrices,
      maTaiKhoan,
      paymentExpiresAt,
    );

    return {
      success: true,
      message: 'Tạo phiếu đặt vé thành công, vui lòng thanh toán.',
      data: {
        MaPhieuDat: result.phieuDatVe.MaPhieuDat,
        TongTien: totalAmount,
        TrangThai: result.phieuDatVe.TrangThai,
        NgayTao: result.phieuDatVe.NgayTao,
        DanhSachGhe: seatPrices.map((sp) => ({
          MaGheSuatChieu: sp.maGheSuatChieu,
          TenGhe: sp.tenGhe,
          GiaVe: sp.price,
        })),
      },
    };
  }

  // Fallback to simulated checkout for other payment methods (like TIEN_MAT)
  return thanhToanGiaLap(maSuatChieu, seatIds, phuongThuc, 'THANH_CONG', maTaiKhoan);
};


// ==================================================
// 3. POST /api/v1/dat-ve/:maPhieuDat/huy
// ==================================================

export const huyPhieuDatVe = async (
  maPhieuDat: string,
  lyDoHoan: string | undefined,
  maTaiKhoan: string,
  bankInfo?: { TenNganHang: string; SoTaiKhoan: string; TenChuTaiKhoan: string },
) => {
  // 1. Get customer from account
  const customer = await findCustomerByAccountId(maTaiKhoan);
  if (!customer) {
    throw new BadRequestError('Tài khoản không phải là khách hàng hợp lệ.');
  }

  // 2. Fetch booking and verify customer ownership
  const booking = await findBookingForCustomer(maPhieuDat, customer.MaKhachHang);
  if (!booking) {
    throw new NotFoundError(`Không tìm thấy phiếu đặt vé với mã: ${maPhieuDat}`);
  }

  if (booking.TrangThai === 'DA_HUY') {
    throw new BadRequestError('Phiếu đặt vé này đã được hủy trước đó.');
  }

  if (booking.DaCheckIn) {
    throw new BadRequestError('Vé đã check-in nên không thể hủy.');
  }

  // 3. Verify showtime has not started
  const showtime = booking.ChiTietDatVes[0]?.GheSuatChieu?.SuatChieu;
  if (!showtime) {
    throw new BadRequestError('Phiếu đặt vé không chứa thông tin suất chiếu hợp lệ.');
  }

  const now = new Date();
  const showtimeStart = combineShowtimeDateTime(showtime.NgayChieu, showtime.GioChieu);

  if (showtimeStart <= now) {
    throw new BadRequestError('Suất chiếu của vé này đã bắt đầu hoặc đã diễn ra, không thể hủy.');
  }

  const seatIds = booking.ChiTietDatVes.map((ct) => ct.MaGheSuatChieu);

  // 4. Check if booking is unpaid (CHO_THANH_TOAN)
  if (booking.TrangThai === 'CHO_THANH_TOAN') {
    await cancelBooking(maPhieuDat, seatIds);
    return {
      success: true,
      message: 'Hủy vé thành công',
    };
  }

  // 5. If booking is paid (DA_THANH_TOAN)
  if (booking.TrangThai === 'DA_THANH_TOAN') {
    // Validate bank info
    if (!bankInfo || !bankInfo.TenNganHang || !bankInfo.SoTaiKhoan || !bankInfo.TenChuTaiKhoan) {
      throw new BadRequestError('Thông tin tài khoản ngân hàng để hoàn tiền không được để trống.');
    }

    // Prevent duplicate refund request
    const pendingRefund = await findPendingRefundRequest(maPhieuDat);
    if (pendingRefund) {
      throw new BadRequestError('Yêu cầu hoàn tiền cho phiếu đặt vé này đang được xử lý.');
    }

    // Find successful transaction
    const successfulTx = await findSuccessfulTransactionByBooking(maPhieuDat);
    if (!successfulTx) {
      throw new BadRequestError('Không tìm thấy giao dịch thanh toán thành công cho phiếu đặt vé này.');
    }

    const lyDo = lyDoHoan || 'Khách hàng hủy vé';

    // Cancel paid booking and create refund request in transaction
    await prisma.$transaction(async (tx) => {
      // Claim the booking before creating the refund so check-in cannot win too.
      const claimed = await tx.phieuDatVe.updateMany({
        where: {
          MaPhieuDat: maPhieuDat,
          TrangThai: 'DA_THANH_TOAN',
          DaCheckIn: false,
        },
        data: { TrangThai: 'DA_HUY' },
      });
      if (claimed.count !== 1) {
        throw new BadRequestError('Vé đã check-in hoặc không còn có thể hủy.');
      }

      // Create refund request
      await createRefundRequest(tx, successfulTx.MaGiaoDich, Number(successfulTx.SoTien), lyDo, bankInfo);
    });

    return {
      success: true,
      message: 'Hủy vé thành công, yêu cầu hoàn tiền đang chờ duyệt',
    };
  }

  throw new BadRequestError('Trạng thái phiếu đặt vé không hợp lệ để thực hiện hủy.');
};
