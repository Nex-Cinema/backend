import { findCustomerByAccountId } from '../repositories/datve.repository';
import {
  findBookingHistoryByCustomer,
  countBookingHistoryByCustomer,
  findBookingDetailByCustomer,
} from '../repositories/lichsu.repository';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { BookingHistoryQueryInput } from '../validators/lichsu.validator';
import { formatSeatLabel } from '../utils/seatPricing';

/**
 * Retrieve transaction/booking history list for the customer
 */
export const getLichSuGiaoDich = async (
  maTaiKhoan: string,
  query: BookingHistoryQueryInput,
) => {
  const customer = await findCustomerByAccountId(maTaiKhoan);
  if (!customer) {
    throw new BadRequestError('Tài khoản không phải là khách hàng hợp lệ.');
  }

  const { page, limit, trangThai, tuNgay, denNgay } = query;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    findBookingHistoryByCustomer(customer.MaKhachHang, { trangThai, tuNgay, denNgay }, skip, limit),
    countBookingHistoryByCustomer(customer.MaKhachHang, { trangThai, tuNgay, denNgay }),
  ]);

  const formattedItems = items.map((p) => {
    const firstDetail = p.ChiTietDatVes[0];
    const suatChieu = firstDetail?.GheSuatChieu?.SuatChieu;
    const phimInfo = suatChieu
      ? {
          TenPhim: suatChieu.Phim.TenPhim,
          NgayChieu: suatChieu.NgayChieu,
          GioChieu: suatChieu.GioChieu,
          TenPhong: suatChieu.PhongChieu.TenPhong,
        }
      : null;

    return {
      MaPhieuDat: p.MaPhieuDat,
      TongTien: Number(p.TongTien),
      TrangThai: p.TrangThai,
      NgayTao: p.NgayTao,
      SoLuongVe: p.ChiTietDatVes.length,
      Phim: phimInfo,
      GiaoDichs: p.GiaoDichs.map((gd) => ({
        MaGiaoDich: gd.MaGiaoDich,
        PhuongThuc: gd.PhuongThuc,
        SoTien: Number(gd.SoTien),
        TrangThai: gd.TrangThai,
        MaGiaoDichNgoai: gd.MaGiaoDichNgoai,
        NgayGiaoDich: gd.NgayGiaoDich,
      })),
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
 * Get detailed ticket information for electronic ticket display
 */
export const getChiTietLichSu = async (maPhieuDat: string, maTaiKhoan: string) => {
  const customer = await findCustomerByAccountId(maTaiKhoan);
  if (!customer) {
    throw new BadRequestError('Tài khoản không phải là khách hàng hợp lệ.');
  }

  const booking = await findBookingDetailByCustomer(maPhieuDat, customer.MaKhachHang);
  if (!booking) {
    throw new NotFoundError(`Không tìm thấy chi tiết phiếu đặt vé với mã: ${maPhieuDat}`);
  }

  return {
    MaPhieuDat: booking.MaPhieuDat,
    TongTien: Number(booking.TongTien),
    TrangThai: booking.TrangThai,
    NgayTao: booking.NgayTao,
    ChiTietDatVes: booking.ChiTietDatVes.map((ct) => {
      const gsc = ct.GheSuatChieu;
      return {
        MaChiTietDat: ct.MaChiTietDat,
        GiaVe: Number(ct.GiaVe),
        Ghe: {
          MaGheSuatChieu: gsc.MaGheSuatChieu,
          ViTriDay: gsc.Ghe.ViTriDay,
          ViTriCot: gsc.Ghe.ViTriCot,
          TenGhe: formatSeatLabel(gsc.Ghe.ViTriDay, gsc.Ghe.ViTriCot, gsc.Ghe.DoRongCot),
          DoRongCot: gsc.Ghe.DoRongCot,
          SucChua: gsc.Ghe.SucChua,
          TenLoaiGhe: gsc.Ghe.LoaiGhe.TenLoaiGhe,
        },
        SuatChieu: {
          MaSuatChieu: gsc.SuatChieu.MaSuatChieu,
          NgayChieu: gsc.SuatChieu.NgayChieu,
          GioChieu: gsc.SuatChieu.GioChieu,
          Phim: {
            MaPhim: gsc.SuatChieu.Phim.MaPhim,
            TenPhim: gsc.SuatChieu.Phim.TenPhim,
            ThoiLuong: gsc.SuatChieu.Phim.ThoiLuong,
            GioiHanTuoi: gsc.SuatChieu.Phim.GioiHanTuoi,
          },
          PhongChieu: {
            MaPhong: gsc.SuatChieu.PhongChieu.MaPhong,
            TenPhong: gsc.SuatChieu.PhongChieu.TenPhong,
            TenLoaiPhong: gsc.SuatChieu.PhongChieu.LoaiPhong.TenLoaiPhong,
          },
          LoaiNgay: {
            TenLoaiNgay: gsc.SuatChieu.LoaiNgay.TenLoaiNgay,
          },
        },
      };
    }),
    GiaoDichs: booking.GiaoDichs.map((gd) => ({
      MaGiaoDich: gd.MaGiaoDich,
      PhuongThuc: gd.PhuongThuc,
      SoTien: Number(gd.SoTien),
      TrangThai: gd.TrangThai,
      MaGiaoDichNgoai: gd.MaGiaoDichNgoai,
      NgayGiaoDich: gd.NgayGiaoDich,
      LichSuHoanTiens: gd.LichSuHoanTiens.map((lh) => ({
        MaHoanTien: lh.MaHoanTien,
        SoTienHoan: Number(lh.SoTienHoan),
        LyDo: lh.LyDo,
        TrangThai: lh.TrangThai,
        NgayHoanTien: lh.NgayHoanTien,
        NgayTao: lh.NgayTao,
      })),
    })),
  };
};
