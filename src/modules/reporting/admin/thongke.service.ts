import prisma from '../../../config/prisma';
import { StatsQueryInput } from './thongke.validator';

export interface DoanhThuResponse {
  TongDoanhThu: number;
  DoanhThuTheoPhim: {
    MaPhim: string;
    TenPhim: string;
    DoanhThu: number;
    SoVeBanRa: number;
  }[];
  DoanhThuTheoPhuongThuc: {
    PhuongThuc: string;
    DoanhThu: number;
  }[];
}

export interface TiLeGheResponse {
  MaSuatChieu: string;
  NgayChieu: Date;
  GioChieu: Date;
  TenPhim: string;
  TenPhong: string;
  TongSoGhe: number;
  SoGheDaDat: number;
  TiLeLapDay: number;
}

export const getDoanhThuStats = async (query: StatsQueryInput): Promise<DoanhThuResponse> => {
  const { tuNgay, denNgay, maPhim } = query;

  const whereClause: any = {
    KhaDung: true,
    TrangThai: 'THANH_CONG',
    PhieuDatVe: {
      KhaDung: true,
      TrangThai: 'DA_THANH_TOAN',
    },
  };

  if (tuNgay || denNgay) {
    whereClause.NgayGiaoDich = {};
    if (tuNgay) {
      whereClause.NgayGiaoDich.gte = new Date(`${tuNgay}T00:00:00.000Z`);
    }
    if (denNgay) {
      whereClause.NgayGiaoDich.lte = new Date(`${denNgay}T23:59:59.999Z`);
    }
  }

  if (maPhim) {
    whereClause.PhieuDatVe.ChiTietDatVes = {
      some: {
        GheSuatChieu: {
          SuatChieu: {
            MaPhim: maPhim,
          },
        },
      },
    };
  }

  const transactions = await prisma.giaoDich.findMany({
    where: whereClause,
    include: {
      PhieuDatVe: {
        include: {
          ChiTietDatVes: {
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
          },
        },
      },
    },
  });

  let TongDoanhThu = 0;
  const phimMap = new Map<string, { TenPhim: string; DoanhThu: number; SoVeBanRa: number }>();
  const phuongThucMap = new Map<string, number>();

  for (const tx of transactions) {
    const amount = Number(tx.SoTien);
    TongDoanhThu += amount;

    // Aggregating payment methods
    const pt = tx.PhuongThuc;
    phuongThucMap.set(pt, (phuongThucMap.get(pt) || 0) + amount);

    // Aggregating per movie.
    // If a transaction matches, calculate its ticket items.
    if (tx.PhieuDatVe && tx.PhieuDatVe.ChiTietDatVes) {
      for (const ct of tx.PhieuDatVe.ChiTietDatVes) {
        const sc = ct.GheSuatChieu?.SuatChieu;
        if (sc && sc.Phim) {
          const movie = sc.Phim;
          const movieKey = movie.MaPhim;
          const ticketPrice = Number(ct.GiaVe);

          const existing = phimMap.get(movieKey) || {
            TenPhim: movie.TenPhim,
            DoanhThu: 0,
            SoVeBanRa: 0,
          };

          existing.DoanhThu += ticketPrice;
          existing.SoVeBanRa += 1;
          phimMap.set(movieKey, existing);
        }
      }
    }
  }

  // Convert map to array format
  const DoanhThuTheoPhim = Array.from(phimMap.entries()).map(([MaPhim, val]) => ({
    MaPhim,
    TenPhim: val.TenPhim,
    DoanhThu: Number(val.DoanhThu.toFixed(2)),
    SoVeBanRa: val.SoVeBanRa,
  }));

  const DoanhThuTheoPhuongThuc = Array.from(phuongThucMap.entries()).map(([PhuongThuc, val]) => ({
    PhuongThuc,
    DoanhThu: Number(val.toFixed(2)),
  }));

  return {
    TongDoanhThu: Number(TongDoanhThu.toFixed(2)),
    DoanhThuTheoPhim,
    DoanhThuTheoPhuongThuc,
  };
};

export const getFillRateStats = async (query: Omit<StatsQueryInput, 'maPhim'>): Promise<TiLeGheResponse[]> => {
  const { tuNgay, denNgay } = query;

  const whereClause: any = {
    KhaDung: true,
  };

  if (tuNgay || denNgay) {
    whereClause.NgayChieu = {};
    if (tuNgay) {
      whereClause.NgayChieu.gte = new Date(`${tuNgay}T00:00:00.000Z`);
    }
    if (denNgay) {
      whereClause.NgayChieu.lte = new Date(`${denNgay}T23:59:59.999Z`);
    }
  }

  const suatChieus = await prisma.suatChieu.findMany({
    where: whereClause,
    include: {
      Phim: {
        select: { TenPhim: true },
      },
      PhongChieu: {
        select: { TenPhong: true },
      },
      GheSuatChieus: {
        where: { KhaDung: true },
        select: { TrangThai: true },
      },
    },
  });

  return suatChieus.map((sc) => {
    const TongSoGhe = sc.GheSuatChieus.length;
    const SoGheDaDat = sc.GheSuatChieus.filter((g) => g.TrangThai === 'DA_DAT').length;
    const TiLeLapDay = TongSoGhe > 0 ? Number(((SoGheDaDat / TongSoGhe) * 100).toFixed(2)) : 0;

    return {
      MaSuatChieu: sc.MaSuatChieu,
      NgayChieu: sc.NgayChieu,
      GioChieu: sc.GioChieu,
      TenPhim: sc.Phim.TenPhim,
      TenPhong: sc.PhongChieu.TenPhong,
      TongSoGhe,
      SoGheDaDat,
      TiLeLapDay,
    };
  });
};
