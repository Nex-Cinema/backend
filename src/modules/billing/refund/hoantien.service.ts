import { identityQueries } from '../../identity';
import { bookingQueries } from '../../booking';
import {
  findSuccessfulTransactionByBooking,
  findPendingRefundByBooking,
  createRefundRequest,
  findRefundRequestsByCustomer,
  countRefundRequestsByCustomer,
  findRefundRequestsAdmin,
  countRefundRequestsAdmin,
  findRefundRequestByIdAdmin,
  approveRefundRequest,
  rejectRefundRequest,
} from './hoantien.repository';
import { BadRequestError, NotFoundError } from '../../../utils/errors';

const { findCustomerByAccountId } = identityQueries;
const { findBookingForCustomer } = bookingQueries;
import {
  RefundRequestInput,
  RefundListQueryInput,
  AdminRefundQueryInput,
} from './hoantien.validator';

/**
 * Customer submits a refund request for a booking
 */
export const yeuCauHoanTien = async (maTaiKhoan: string, input: RefundRequestInput) => {
  const customer = await findCustomerByAccountId(maTaiKhoan);
  if (!customer) {
    throw new BadRequestError('Tài khoản không phải là khách hàng hợp lệ.');
  }

  // Find booking and ensure it belongs to customer
  const booking = await findBookingForCustomer(input.MaPhieuDat, customer.MaKhachHang);
  if (!booking) {
    throw new NotFoundError(`Không tìm thấy phiếu đặt vé với mã: ${input.MaPhieuDat}`);
  }

  // Check booking status (must be paid or cancelled already)
  if (booking.TrangThai !== 'DA_THANH_TOAN' && booking.TrangThai !== 'DA_HUY') {
    throw new BadRequestError('Chỉ có thể yêu cầu hoàn tiền cho vé đã thanh toán hoặc đã hủy.');
  }

  // Check showtime has not started yet
  const showtime = booking.ChiTietDatVes[0]?.GheSuatChieu?.SuatChieu;
  if (!showtime) {
    throw new BadRequestError('Thông tin suất chiếu không hợp lệ.');
  }

  const now = new Date();
  const showtimeStart = new Date(showtime.NgayChieu);
  const gioChieu = new Date(showtime.GioChieu);
  showtimeStart.setHours(gioChieu.getHours(), gioChieu.getMinutes(), gioChieu.getSeconds());

  if (showtimeStart <= now) {
    throw new BadRequestError('Suất chiếu đã bắt đầu hoặc đã diễn ra, không thể yêu cầu hoàn tiền.');
  }

  // Prevent duplicate pending refund request
  const pendingRefund = await findPendingRefundByBooking(input.MaPhieuDat);
  if (pendingRefund) {
    throw new BadRequestError('Đã tồn tại yêu cầu hoàn tiền đang chờ xử lý cho phiếu đặt vé này.');
  }

  // Find successful transaction
  const successfulTx = await findSuccessfulTransactionByBooking(input.MaPhieuDat);
  if (!successfulTx) {
    throw new BadRequestError('Không tìm thấy giao dịch thanh toán thành công cho phiếu đặt vé này.');
  }

  // Create refund request using transaction (sets booking to DA_HUY + creates LichSuHoanTien)
  const refund = await createRefundRequest(
    input.MaPhieuDat,
    successfulTx.MaGiaoDich,
    Number(successfulTx.SoTien),
    input.LyDo,
    {
      TenNganHang: input.TenNganHang,
      SoTaiKhoan: input.SoTaiKhoan,
      TenChuTaiKhoan: input.TenChuTaiKhoan,
    },
  );

  return {
    MaHoanTien: refund.MaHoanTien,
    MaGiaoDich: refund.MaGiaoDich,
    SoTienHoan: Number(refund.SoTienHoan),
    LyDo: refund.LyDo,
    TrangThai: refund.TrangThai,
    NgayHoanTien: refund.NgayHoanTien,
    NgayTao: refund.NgayTao,
    TenNganHang: refund.TenNganHang,
    SoTaiKhoan: refund.SoTaiKhoan,
    TenChuTaiKhoan: refund.TenChuTaiKhoan,
  };
};

/**
 * Retrieve paginated list of refund requests submitted by the logged-in customer
 */
export const getHoanTienCuaToi = async (maTaiKhoan: string, query: RefundListQueryInput) => {
  const customer = await findCustomerByAccountId(maTaiKhoan);
  if (!customer) {
    throw new BadRequestError('Tài khoản không phải là khách hàng hợp lệ.');
  }

  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    findRefundRequestsByCustomer(customer.MaKhachHang, skip, limit),
    countRefundRequestsByCustomer(customer.MaKhachHang),
  ]);

  const formattedItems = items.map((refund) => {
    const gd = refund.GiaoDich;
    const booking = gd.PhieuDatVe;
    const firstDetail = booking.ChiTietDatVes[0];
    const suatChieu = firstDetail?.GheSuatChieu?.SuatChieu;
    const movieSummary = suatChieu
      ? {
          TenPhim: suatChieu.Phim.TenPhim,
          NgayChieu: suatChieu.NgayChieu,
          GioChieu: suatChieu.GioChieu,
        }
      : null;

    return {
      MaHoanTien: refund.MaHoanTien,
      SoTienHoan: Number(refund.SoTienHoan),
      LyDo: refund.LyDo,
      TrangThai: refund.TrangThai,
      NgayHoanTien: refund.NgayHoanTien,
      NgayTao: refund.NgayTao,
      TenNganHang: refund.TenNganHang,
      SoTaiKhoan: refund.SoTaiKhoan,
      TenChuTaiKhoan: refund.TenChuTaiKhoan,
      GiaoDich: {
        MaGiaoDich: gd.MaGiaoDich,
        PhuongThuc: gd.PhuongThuc,
        SoTien: Number(gd.SoTien),
      },
      PhieuDatVe: {
        MaPhieuDat: booking.MaPhieuDat,
        TongTien: Number(booking.TongTien),
        TrangThai: booking.TrangThai,
        Movie: movieSummary,
      },
    };
  });

  return {
    items: formattedItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Reusable helper to format Prisma decimal numbers and nested relations for admin response
 */
const mapAdminRefundRequest = (refund: any) => {
  if (!refund) return null;
  const gd = refund.GiaoDich;
  const phieu = gd?.PhieuDatVe;
  const kh = phieu?.KhachHang;
  const tk = kh?.TaiKhoan;

  return {
    MaHoanTien: refund.MaHoanTien,
    MaGiaoDich: refund.MaGiaoDich,
    SoTienHoan: Number(refund.SoTienHoan),
    LyDo: refund.LyDo,
    TrangThai: refund.TrangThai,
    NgayHoanTien: refund.NgayHoanTien,
    NgayTao: refund.NgayTao,
    NgayCapNhat: refund.NgayCapNhat,
    TenNganHang: refund.TenNganHang,
    SoTaiKhoan: refund.SoTaiKhoan,
    TenChuTaiKhoan: refund.TenChuTaiKhoan,
    GiaoDich: gd ? {
      MaGiaoDich: gd.MaGiaoDich,
      MaPhieuDat: gd.MaPhieuDat,
      PhuongThuc: gd.PhuongThuc,
      SoTien: Number(gd.SoTien),
      TrangThai: gd.TrangThai,
      MaGiaoDichNgoai: gd.MaGiaoDichNgoai,
      PhieuDatVe: phieu ? {
        MaPhieuDat: phieu.MaPhieuDat,
        TrangThai: phieu.TrangThai,
        TongTien: Number(phieu.TongTien),
        KhachHang: kh ? {
          MaKhachHang: kh.MaKhachHang,
          TaiKhoan: tk ? {
            MaTaiKhoan: tk.MaTaiKhoan,
            HoTen: tk.HoTen,
            Email: tk.Email,
            SoDienThoai: tk.SoDienThoai,
          } : null
        } : null,
        ChiTietDatVes: phieu.ChiTietDatVes ? phieu.ChiTietDatVes.map((ct: any) => {
          const gsc = ct.GheSuatChieu;
          const ghe = gsc?.Ghe;
          const sc = gsc?.SuatChieu;
          const phim = sc?.Phim;
          const phong = sc?.PhongChieu;
          
          return {
            MaChiTietDat: ct.MaChiTietDat,
            GiaVe: Number(ct.GiaVe),
            GheSuatChieu: gsc ? {
              Ghe: ghe ? {
                MaGhe: ghe.MaGhe,
                ViTriDay: ghe.ViTriDay,
                ViTriCot: ghe.ViTriCot,
                MaPhong: ghe.MaPhong,
                MaLoaiGhe: ghe.MaLoaiGhe,
              } : null,
              SuatChieu: sc ? {
                MaSuatChieu: sc.MaSuatChieu,
                NgayChieu: sc.NgayChieu,
                GioChieu: sc.GioChieu,
                Phim: phim ? {
                  MaPhim: phim.MaPhim,
                  TenPhim: phim.TenPhim,
                  ThoiLuong: phim.ThoiLuong,
                  TheLoai: phim.TheLoai,
                  HinhAnh: phim.HinhAnh,
                } : null,
                PhongChieu: phong ? {
                  MaPhong: phong.MaPhong,
                  TenPhong: phong.TenPhong,
                } : null,
              } : null,
            } : null,
          };
        }) : [],
      } : null,
    } : null,
  };
};

/**
 * Retrieve paginated and filtered refund requests for ADMIN
 */
export const getRefundRequestsAdmin = async (query: AdminRefundQueryInput) => {
  const { page, limit, trangThai, keyword } = query;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    findRefundRequestsAdmin(skip, limit, trangThai, keyword),
    countRefundRequestsAdmin(trangThai, keyword),
  ]);

  const formattedItems = items.map(mapAdminRefundRequest);

  return {
    items: formattedItems,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get detailed refund request by ID for ADMIN
 */
export const getRefundRequestByIdAdmin = async (maHoanTien: string) => {
  const refund = await findRefundRequestByIdAdmin(maHoanTien);
  if (!refund) {
    throw new NotFoundError(`Không tìm thấy yêu cầu hoàn tiền với mã: ${maHoanTien}`);
  }
  return mapAdminRefundRequest(refund);
};

/**
 * Approve a pending refund request
 */
export const approveRefundRequestAdmin = async (maHoanTien: string) => {
  const refund = await findRefundRequestByIdAdmin(maHoanTien);
  if (!refund) {
    throw new NotFoundError(`Không tìm thấy yêu cầu hoàn tiền với mã: ${maHoanTien}`);
  }

  // Business Rule: Check if status is CHO_XU_LY
  if (refund.TrangThai !== 'CHO_XU_LY') {
    throw new BadRequestError('Yêu cầu hoàn tiền đã được xử lý');
  }

  // Execute approval transaction
  await approveRefundRequest(maHoanTien);

  // Retrieve updated refund request detail
  const updatedRefund = await findRefundRequestByIdAdmin(maHoanTien);
  return mapAdminRefundRequest(updatedRefund);
};

/**
 * Reject a pending refund request
 */
export const rejectRefundRequestAdmin = async (maHoanTien: string) => {
  const refund = await findRefundRequestByIdAdmin(maHoanTien);
  if (!refund) {
    throw new NotFoundError(`Không tìm thấy yêu cầu hoàn tiền với mã: ${maHoanTien}`);
  }

  // Business Rule: Check if status is CHO_XU_LY
  if (refund.TrangThai !== 'CHO_XU_LY') {
    throw new BadRequestError('Yêu cầu hoàn tiền đã được xử lý');
  }

  // Execute rejection
  await rejectRefundRequest(maHoanTien);

  // Retrieve updated refund request detail
  const updatedRefund = await findRefundRequestByIdAdmin(maHoanTien);
  return mapAdminRefundRequest(updatedRefund);
};
