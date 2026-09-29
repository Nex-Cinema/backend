import { BadRequestError, NotFoundError } from '../../../utils/errors';
import { combineShowtimeDateTime } from '../../../utils/showtimeDateTime';
import { milliseconds } from '../../../shared/time';
import {
  findBookingForCheckIn,
  markBookingCheckedIn,
} from './admission.repository';
import { CheckInBookingInput } from './admission.validator';
import { CHECK_IN_EARLY_MINUTES } from './admission.constants';

const BOOKING_QR_PREFIX = 'QR_';

export const checkInBooking = async (input: CheckInBookingInput) => {
  if (!input.QRPayload.startsWith(BOOKING_QR_PREFIX)) {
    throw new BadRequestError('Mã QR không hợp lệ');
  }

  const maPhieuDat = input.QRPayload.slice(BOOKING_QR_PREFIX.length);
  const booking = await findBookingForCheckIn(maPhieuDat);
  if (!booking) {
    throw new NotFoundError('Không tìm thấy phiếu đặt vé');
  }

  if (booking.DaCheckIn) {
    throw new BadRequestError('Vé đã được sử dụng');
  }

  const hasSuccessfulPayment = booking.GiaoDichs.some(
    (transaction) => transaction.TrangThai === 'THANH_CONG',
  );
  if (booking.TrangThai !== 'DA_THANH_TOAN' || !hasSuccessfulPayment) {
    throw new BadRequestError('Thanh toán chưa hoàn tất');
  }

  const showtime = booking.ChiTietDatVes[0]?.GheSuatChieu.SuatChieu;
  if (!showtime) {
    throw new BadRequestError('Phiếu đặt vé không có thông tin suất chiếu');
  }

  const hasActiveRefund = booking.GiaoDichs.some(
    (transaction) => transaction.LichSuHoanTiens.length > 0,
  );
  if (hasActiveRefund) {
    throw new BadRequestError('Vé đang hoàn tiền hoặc đã được hoàn tiền');
  }

  const thoiGianCheckIn = new Date();
  const showtimeStart = combineShowtimeDateTime(
    showtime.NgayChieu,
    showtime.GioChieu,
  );
  const checkInStart = new Date(
    showtimeStart.getTime() - milliseconds.minutes(CHECK_IN_EARLY_MINUTES),
  );
  if (thoiGianCheckIn < checkInStart) {
    throw new BadRequestError(
      `Chỉ có thể check-in trước giờ chiếu ${CHECK_IN_EARLY_MINUTES} phút`,
    );
  }

  const showtimeEnd = new Date(
    showtimeStart.getTime() + milliseconds.minutes(showtime.Phim.ThoiLuong),
  );
  if (thoiGianCheckIn > showtimeEnd) {
    throw new BadRequestError('Suất chiếu đã kết thúc, không thể check-in');
  }

  const result = await markBookingCheckedIn(maPhieuDat, thoiGianCheckIn);
  if (result.count !== 1) {
    throw new BadRequestError('Phiếu đặt vé không hợp lệ hoặc đã được sử dụng');
  }

  return {
    MaPhieuDat: booking.MaPhieuDat,
    DaCheckIn: true,
    ThoiGianCheckIn: thoiGianCheckIn,
    SoLuongGhe: booking._count.ChiTietDatVes,
  };
};
