import {
  findStaffByAccountId,
  findTicketForValidation,
  findRefundStatusForTicket,
  markSeatCheckedIn,
  findCheckInHistory,
  countCheckInHistory,
  CheckInHistoryFilters,
} from './staffSoatVe.repository';
import { UnauthorizedError, BadRequestError } from '../../../utils/errors';
import { operationalSettings } from '../../operational-settings';
import { milliseconds } from '../../../shared/time';
import { ValidateTicketInput, CheckInInput, HistoryQueryInput } from './staffSoatVe.validator';

export interface TicketValidationResponse {
  valid: boolean;
  reason: string;
  ticketInfo?: {
    MaChiTietDat: string;
    TenPhim: string;
    TenPhong: string;
    Ghe: string;
    GiaVe: number;
    NgayChieu: Date;
    GioChieu: Date;
  };
}

/**
 * Validate a seat ticket
 */
export const validateTicket = async (
  maTaiKhoan: string,
  body: ValidateTicketInput,
): Promise<TicketValidationResponse> => {
  // 1. Verify active staff account
  const staff = await findStaffByAccountId(maTaiKhoan);
  if (!staff) {
    throw new UnauthorizedError('Tài khoản đã bị vô hiệu hóa hoặc không có quyền nhân viên');
  }

  const now = new Date();

  // 2. Fetch ticket detail
  const ticket = await findTicketForValidation(body.MaChiTietDat);
  if (!ticket) {
    return { valid: false, reason: 'Vé không tồn tại' };
  }

  // 3. Check already checked-in status
  if (ticket.DaCheckIn) {
    return { valid: false, reason: 'Vé đã được sử dụng' };
  }

  // 4. Check booking status (DA_HUY)
  if (ticket.PhieuDatVe.TrangThai === 'DA_HUY') {
    return { valid: false, reason: 'Vé đã bị hủy' };
  }

  // 5. Check payment status (must be DA_THANH_TOAN and successful transaction exists)
  if (ticket.PhieuDatVe.TrangThai !== 'DA_THANH_TOAN') {
    return { valid: false, reason: 'Thanh toán chưa hoàn tất' };
  }

  const hasSuccessfulTx = ticket.PhieuDatVe.GiaoDichs.some((tx) => tx.TrangThai === 'THANH_CONG');
  if (!hasSuccessfulTx) {
    return { valid: false, reason: 'Thanh toán chưa hoàn tất' };
  }

  // 6. Check active refund status (CHO_XU_LY or DA_HOAN)
  const refundStatus = await findRefundStatusForTicket(ticket.MaPhieuDat);
  if (refundStatus) {
    return { valid: false, reason: 'Vé đang hoàn tiền / đã hoàn tiền' };
  }

  // 7. Check showtime validity window using the current operational policy.
  //    Staff can still scan tickets after a showtime has started (latecomers),
  //    but not before the pre-entry window or after the movie has ended.
  const suatChieu = ticket.GheSuatChieu.SuatChieu;
  const showtimeStart = new Date(suatChieu.NgayChieu);
  const gioChieu = new Date(suatChieu.GioChieu);
  showtimeStart.setUTCHours(gioChieu.getUTCHours(), gioChieu.getUTCMinutes(), gioChieu.getUTCSeconds(), 0);

  const settings = await operationalSettings.get();
  const showtimeEnd = new Date(
    showtimeStart.getTime() + milliseconds.minutes(suatChieu.Phim.ThoiLuong),
  );
  const checkInStart = new Date(
    showtimeStart.getTime() - milliseconds.minutes(settings.CuaSoCheckInPhut),
  );

  if (now < checkInStart) {
    return {
      valid: false,
      reason: `Chưa đến giờ check-in (trước ${settings.CuaSoCheckInPhut} phút suất chiếu)`,
    };
  }

  if (now > showtimeEnd) {
    return { valid: false, reason: 'Suất chiếu đã kết thúc, không thể check-in' };
  }

  // 8. Return validation success details
  return {
    valid: true,
    reason: 'Vé hợp lệ',
    ticketInfo: {
      MaChiTietDat: ticket.MaChiTietDat,
      TenPhim: suatChieu.Phim.TenPhim,
      TenPhong: suatChieu.PhongChieu.TenPhong,
      Ghe: `${ticket.GheSuatChieu.Ghe.ViTriDay}${ticket.GheSuatChieu.Ghe.ViTriCot}`,
      GiaVe: Number(ticket.GiaVe),
      NgayChieu: suatChieu.NgayChieu,
      GioChieu: suatChieu.GioChieu,
    },
  };
};

/**
 * Perform actual check-in for a ticket
 */
export const checkInTicket = async (
  maTaiKhoan: string,
  body: CheckInInput,
) => {
  // 1. Verify active staff account
  const staff = await findStaffByAccountId(maTaiKhoan);
  if (!staff) {
    throw new UnauthorizedError('Tài khoản đã bị vô hiệu hóa hoặc không có quyền nhân viên');
  }

  // 2. Perform full ticket validation
  const validation = await validateTicket(maTaiKhoan, { MaChiTietDat: body.MaChiTietDat });
  if (!validation.valid || !validation.ticketInfo) {
    throw new BadRequestError(validation.reason);
  }

  const now = new Date();
  const resolvedMaChiTietDat = validation.ticketInfo.MaChiTietDat;

  // 3. Mark checked in
  const success = await markSeatCheckedIn(resolvedMaChiTietDat, staff.MaNhanVien, now);
  if (!success) {
    throw new BadRequestError('Vé đã được sử dụng');
  }

  // Fetch ticket details again for the response metadata
  const ticket = await findTicketForValidation(resolvedMaChiTietDat);
  const suatChieu = ticket!.GheSuatChieu.SuatChieu;

  return {
    MaChiTietDat: ticket!.MaChiTietDat,
    ThoiGianCheckIn: now,
    NhanVienCheckIn: {
      MaNhanVien: staff.MaNhanVien,
      HoTen: staff.TaiKhoan.HoTen,
    },
    TicketInfo: {
      TenPhim: suatChieu.Phim.TenPhim,
      TenPhong: suatChieu.PhongChieu.TenPhong,
      Ghe: `${ticket!.GheSuatChieu.Ghe.ViTriDay}${ticket!.GheSuatChieu.Ghe.ViTriCot}`,
      NgayChieu: suatChieu.NgayChieu,
      GioChieu: suatChieu.GioChieu,
    },
  };
};

/**
 * Get ticket check-in history logs (Staff view)
 */
export const getCheckInHistoryLogs = async (
  maTaiKhoan: string,
  queryFilters: HistoryQueryInput,
) => {
  // 1. Verify active staff account
  const staff = await findStaffByAccountId(maTaiKhoan);
  if (!staff) {
    throw new UnauthorizedError('Tài khoản đã bị vô hiệu hóa hoặc không có quyền nhân viên');
  }

  const { page, limit, tuNgay, denNgay, keyword } = queryFilters;
  const skip = (page - 1) * limit;

  const filters: CheckInHistoryFilters = { tuNgay, denNgay, keyword };

  const [historyItems, total] = await Promise.all([
    findCheckInHistory(filters, skip, limit),
    countCheckInHistory(filters),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  // Map history without exposing customer personal information
  const mappedItems = historyItems.map((item) => {
    const suatChieu = item.GheSuatChieu.SuatChieu;
    return {
      MaChiTietDat: item.MaChiTietDat,
      ThoiGianCheckIn: item.ThoiGianCheckIn,
      NhanVienCheckIn: item.NhanVienCheckIn
        ? {
            MaNhanVien: item.NhanVienCheckIn.MaNhanVien,
            HoTen: item.NhanVienCheckIn.TaiKhoan.HoTen,
            TenDangNhap: item.NhanVienCheckIn.TaiKhoan.TenDangNhap,
          }
        : null,
      TicketInfo: {
        TenPhim: suatChieu.Phim.TenPhim,
        TenPhong: suatChieu.PhongChieu.TenPhong,
        Ghe: `${item.GheSuatChieu.Ghe.ViTriDay}${item.GheSuatChieu.Ghe.ViTriCot}`,
        NgayChieu: suatChieu.NgayChieu,
        GioChieu: suatChieu.GioChieu,
        GiaVe: Number(item.GiaVe),
      },
    };
  });

  return {
    history: mappedItems,
    total,
    page,
    limit,
    totalPages,
  };
};
