import { Role } from '@prisma/client';
import prisma from '../../../config/prisma';
import { ForbiddenError } from '../../../utils/errors';
import { STAFF_DASHBOARD_LIMITS } from '../reporting.constants';

export const getDashboardData = async (maTaiKhoan: string) => {
  // 1. Verify active staff profile
  const staff = await prisma.nhanVien.findFirst({
    where: {
      MaTaiKhoan: maTaiKhoan,
      KhaDung: true,
      TaiKhoan: {
        KhaDung: true,
        VaiTro: Role.STAFF,
      },
    },
  });

  if (!staff) {
    throw new ForbiddenError('Tài khoản không phải nhân viên hoặc đã bị khóa.');
  }

  // 2. Doanh thu tại quầy
  const revenueResult = await prisma.phieuDatVe.aggregate({
    _sum: {
      TongTien: true,
    },
    where: {
      MaNhanVien: staff.MaNhanVien,
      TrangThai: 'DA_THANH_TOAN',
      KhaDung: true,
    },
  });
  const revenue = Number(revenueResult._sum.TongTien || 0);

  // 3. Vé đã bán
  const ticketsSold = await prisma.chiTietDatVe.count({
    where: {
      PhieuDatVe: {
        MaNhanVien: staff.MaNhanVien,
        TrangThai: 'DA_THANH_TOAN',
        KhaDung: true,
      },
      KhaDung: true,
    },
  });

  // 4. Vé đã soát
  const ticketsChecked = await prisma.chiTietDatVe.count({
    where: {
      MaNhanVienCheckIn: staff.MaNhanVien,
      DaCheckIn: true,
      KhaDung: true,
    },
  });

  // 5. Ca trực hiện tại / hôm nay
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayShifts = await prisma.chiTietCaLamViec.findMany({
    where: {
      MaNhanVien: staff.MaNhanVien,
      NgayLamViec: today,
      KhaDung: true,
    },
    include: {
      CaLamViec: true,
    },
  });

  let activeShift = todayShifts.find(reg => {
    const start = reg.CaLamViec.GioBatDau;
    const end = reg.CaLamViec.GioKetThuc;
    const now = new Date();
    
    const currentSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const startSecs = start.getUTCHours() * 3600 + start.getUTCMinutes() * 60 + start.getUTCSeconds();
    const endSecs = end.getUTCHours() * 3600 + end.getUTCMinutes() * 60 + end.getUTCSeconds();
    
    return currentSecs >= startSecs && currentSecs <= endSecs;
  });

  if (!activeShift && todayShifts.length > 0) {
    activeShift = todayShifts[0]; // fallback
  }

  const formatTime = (date: Date) => {
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const shiftName = activeShift
    ? `${activeShift.CaLamViec.TenCa} (${formatTime(activeShift.CaLamViec.GioBatDau)} - ${formatTime(activeShift.CaLamViec.GioKetThuc)})`
    : "Không có ca trực hôm nay";

  // 6. Suất chiếu sắp diễn ra
  const upcomingShowtimes = await prisma.suatChieu.findMany({
    where: {
      NgayChieu: {
        gte: today,
      },
      KhaDung: true,
    },
    include: {
      Phim: true,
      PhongChieu: true,
      GheSuatChieus: {
        where: {
          KhaDung: true,
        },
        select: {
          TrangThai: true,
        },
      },
    },
    orderBy: [
      { NgayChieu: 'asc' },
      { GioChieu: 'asc' },
    ],
    take: STAFF_DASHBOARD_LIMITS.upcomingShowtimeCandidates,
  });

  const now = new Date();
  const upcomingShows = upcomingShowtimes
    .map((sc) => {
      const showtimeStart = new Date(sc.NgayChieu);
      const gioChieu = new Date(sc.GioChieu);
      showtimeStart.setHours(gioChieu.getUTCHours(), gioChieu.getUTCMinutes(), gioChieu.getUTCSeconds(), 0);
      
      if (showtimeStart <= now) {
        return null;
      }

      const total = sc.GheSuatChieus.length;
      const booked = sc.GheSuatChieus.filter((g) => g.TrangThai === 'DA_DAT').length;

      const hh = String(gioChieu.getUTCHours()).padStart(2, '0');
      const mm = String(gioChieu.getUTCMinutes()).padStart(2, '0');

      return {
        movie: {
          id: sc.MaPhim,
          title: sc.Phim.TenPhim,
          genre: sc.Phim.TheLoai,
          duration: sc.Phim.ThoiLuong,
          poster: sc.Phim.HinhAnh,
        },
        showtime: {
          id: sc.MaSuatChieu,
          time: `${hh}:${mm}`,
          room: sc.PhongChieu.TenPhong,
        },
        booked,
        total,
      };
    })
    .filter((show) => show !== null)
    .slice(0, STAFF_DASHBOARD_LIMITS.displayedUpcomingShowtimes);

  // 7. Hoạt động gần đây
  const recentSales = await prisma.phieuDatVe.findMany({
    where: {
      MaNhanVien: staff.MaNhanVien,
      TrangThai: 'DA_THANH_TOAN',
      KhaDung: true,
    },
    orderBy: {
      NgayTao: 'desc',
    },
    take: STAFF_DASHBOARD_LIMITS.recentSales,
  });

  const recentCheckIns = await prisma.chiTietDatVe.findMany({
    where: {
      MaNhanVienCheckIn: staff.MaNhanVien,
      DaCheckIn: true,
      KhaDung: true,
    },
    include: {
      GheSuatChieu: {
        include: {
          SuatChieu: {
            include: {
              Phim: true,
            },
          },
        },
      },
    },
    orderBy: {
      ThoiGianCheckIn: 'desc',
    },
    take: STAFF_DASHBOARD_LIMITS.recentCheckIns,
  });

  const salesActivity = recentSales.map(sale => {
    const date = new Date(sale.NgayTao);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return {
      id: sale.MaPhieuDat,
      time: `${hh}:${mm}`,
      timestamp: date.getTime(),
      type: "Bán vé tại quầy",
      amount: Number(sale.TongTien),
      status: "Thành công"
    };
  });

  const checkinActivity = recentCheckIns.map(ci => {
    const date = ci.ThoiGianCheckIn ? new Date(ci.ThoiGianCheckIn) : new Date(ci.NgayCapNhat || Date.now());
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return {
      id: ci.MaChiTietDat,
      time: `${hh}:${mm}`,
      timestamp: date.getTime(),
      type: `Soát vé: ${ci.GheSuatChieu?.SuatChieu?.Phim?.TenPhim || "Phim"}`,
      amount: 0,
      status: "Hợp lệ"
    };
  });

  const recentActivities = [...salesActivity, ...checkinActivity]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  return {
    stats: {
      revenue,
      ticketsSold,
      ticketsChecked,
      shiftName,
    },
    upcomingShows,
    recentActivities,
  };
};
