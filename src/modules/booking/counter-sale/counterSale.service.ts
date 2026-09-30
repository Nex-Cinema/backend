import { PhuongThucThanhToan, TrangThaiGheSuatChieu, TrangThaiGiaoDich, TrangThaiPhieuDatVe } from '@prisma/client';
import prisma from '../../../config/prisma';
import { milliseconds } from '../../../shared/time';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import { calculateSeatPrice, formatSeatLabel } from '../../../utils/seatPricing';
import { combineShowtimeDateTime } from '../../../utils/showtimeDateTime';
import { operationalSettings } from '../../operational-settings';

export interface CounterSaleInput {
  MaSuatChieu: string;
  DanhSachMaGheSuatChieu: string[];
  PhuongThucThanhToan: 'TIEN_MAT' | 'PAYOS';
  TenKhachHang?: string;
  SoDienThoai?: string;
}

export const createCounterSale = async (input: CounterSaleInput, adminAccountId: string) => {
  const seatIds = Array.from(new Set(input.DanhSachMaGheSuatChieu));
  if (seatIds.length !== input.DanhSachMaGheSuatChieu.length) {
    throw new BadRequestError('Danh sách ghế không được chứa mã trùng nhau.');
  }

  const now = new Date();
  const showtime = await prisma.suatChieu.findFirst({
    where: { MaSuatChieu: input.MaSuatChieu, KhaDung: true },
  });
  if (!showtime) throw new NotFoundError('Không tìm thấy suất chiếu.');
  if (combineShowtimeDateTime(showtime.NgayChieu, showtime.GioChieu) <= now) {
    throw new BadRequestError('Suất chiếu đã bắt đầu, không thể bán vé.');
  }

  const settings = input.PhuongThucThanhToan === 'PAYOS'
    ? await operationalSettings.get()
    : null;
  const expiresAt = settings
    ? new Date(now.getTime() + milliseconds.minutes(settings.ThoiGianGiuGhePhut))
    : null;

  return prisma.$transaction(async (tx) => {
    await tx.gheSuatChieu.updateMany({
      where: {
        MaSuatChieu: input.MaSuatChieu,
        TrangThai: TrangThaiGheSuatChieu.DANG_GIU,
        ThoiGianGiuGhe: { lt: now },
      },
      data: { TrangThai: TrangThaiGheSuatChieu.TRONG, ThoiGianGiuGhe: null, MaTaiKhoanGiu: null },
    });

    const seats = await tx.gheSuatChieu.findMany({
      where: {
        MaSuatChieu: input.MaSuatChieu,
        MaGheSuatChieu: { in: seatIds },
        KhaDung: true,
      },
      include: {
        Ghe: { include: { LoaiGhe: true } },
        SuatChieu: { include: { PhongChieu: { include: { LoaiPhong: true } }, LoaiNgay: true } },
      },
    });
    if (seats.length !== seatIds.length || seats.some((seat) => seat.TrangThai !== TrangThaiGheSuatChieu.TRONG)) {
      throw new BadRequestError('Một hoặc nhiều ghế không còn trống. Vui lòng tải lại sơ đồ ghế.');
    }

    let totalAmount = 0;
    const seatPrices = seats.map((seat) => {
      const price = calculateSeatPrice(
        Number(seat.SuatChieu.GiaVeGoc),
        Number(seat.SuatChieu.PhongChieu.LoaiPhong.PhuThu),
        Number(seat.SuatChieu.LoaiNgay.PhuThu),
        Number(seat.Ghe.LoaiGhe.PhuThu),
        seat.Ghe.SucChua,
      );
      totalAmount += price;
      return {
        maGheSuatChieu: seat.MaGheSuatChieu,
        tenGhe: formatSeatLabel(seat.Ghe.ViTriDay, seat.Ghe.ViTriCot, seat.Ghe.DoRongCot),
        price,
      };
    });

    const pending = input.PhuongThucThanhToan === 'PAYOS';
    const updateResult = await tx.gheSuatChieu.updateMany({
      where: {
        MaSuatChieu: input.MaSuatChieu,
        MaGheSuatChieu: { in: seatIds },
        TrangThai: TrangThaiGheSuatChieu.TRONG,
        KhaDung: true,
      },
      data: pending
        ? { TrangThai: TrangThaiGheSuatChieu.DANG_GIU, MaTaiKhoanGiu: adminAccountId, ThoiGianGiuGhe: expiresAt }
        : { TrangThai: TrangThaiGheSuatChieu.DA_DAT, MaTaiKhoanGiu: null, ThoiGianGiuGhe: null },
    });
    if (updateResult.count !== seatIds.length) {
      throw new BadRequestError('Một hoặc nhiều ghế vừa được người khác chọn. Vui lòng tải lại sơ đồ ghế.');
    }

    const booking = await tx.phieuDatVe.create({
      data: {
        MaKhachHang: null,
        KenhDat: 'TAI_QUAY',
        TenKhachHangTaiQuay: input.TenKhachHang || null,
        SoDienThoaiTaiQuay: input.SoDienThoai || null,
        TongTien: totalAmount,
        TrangThai: pending ? TrangThaiPhieuDatVe.CHO_THANH_TOAN : TrangThaiPhieuDatVe.DA_THANH_TOAN,
        KhaDung: true,
      },
    });

    await tx.chiTietDatVe.createMany({
      data: seatPrices.map((seat) => ({
        MaPhieuDat: booking.MaPhieuDat,
        MaGheSuatChieu: seat.maGheSuatChieu,
        GiaVe: seat.price,
        KhaDung: true,
      })),
    });

    const transaction = await tx.giaoDich.create({
      data: {
        MaPhieuDat: booking.MaPhieuDat,
        PhuongThuc: input.PhuongThucThanhToan as PhuongThucThanhToan,
        SoTien: totalAmount,
        TrangThai: pending ? TrangThaiGiaoDich.CHO_XU_LY : TrangThaiGiaoDich.THANH_CONG,
        NgayGiaoDich: now,
        KhaDung: true,
      },
    });

    return {
      MaPhieuDat: booking.MaPhieuDat,
      MaGiaoDich: transaction.MaGiaoDich,
      TongTien: totalAmount,
      TrangThai: booking.TrangThai,
      PhuongThucThanhToan: transaction.PhuongThuc,
      QRPayload: pending ? null : `QR_${booking.MaPhieuDat}`,
      ThoiGianHetHan: expiresAt,
      DanhSachGhe: seatPrices.map((seat) => ({ TenGhe: seat.tenGhe, GiaVe: seat.price })),
    };
  });
};
