import prisma from '../../../config/prisma';

/**
 * Save a new movie review in the database
 */
export const createReview = async (
  maKhachHang: string,
  maPhim: string,
  soSao: number,
  binhLuan?: string,
) => {
  return prisma.danhGia.create({
    data: {
      MaKhachHang: maKhachHang,
      MaPhim: maPhim,
      SoSao: soSao,
      BinhLuan: binhLuan || null,
      KhaDung: true,
    },
  });
};

/**
 * Fetch reviews for a specific movie (paginated, sorted by newest first), including reviewer's HoTen
 */
export const findReviewsByMovie = async (maPhim: string, skip: number, limit: number) => {
  return prisma.danhGia.findMany({
    where: {
      MaPhim: maPhim,
      KhaDung: true,
    },
    skip,
    take: limit,
    orderBy: {
      NgayTao: 'desc',
    },
    include: {
      KhachHang: {
        include: {
          TaiKhoan: {
            select: {
              HoTen: true,
            },
          },
        },
      },
    },
  });
};

/**
 * Count active reviews for a movie
 */
export const countReviewsByMovie = async (maPhim: string) => {
  return prisma.danhGia.count({
    where: {
      MaPhim: maPhim,
      KhaDung: true,
    },
  });
};

/**
 * Calculate average rating score (DiemTrungBinh) and total quantity of ratings
 */
export const getMovieRatingStats = async (maPhim: string) => {
  const aggregate = await prisma.danhGia.aggregate({
    where: {
      MaPhim: maPhim,
      KhaDung: true,
    },
    _avg: {
      SoSao: true,
    },
    _count: {
      MaDanhGia: true,
    },
  });

  return {
    DiemTrungBinh: aggregate._avg.SoSao || 0,
    SoLuongDanhGia: aggregate._count.MaDanhGia || 0,
  };
};

/**
 * Retrieve movie if it exists and is active (KhaDung = true)
 */
export const findActiveMovieById = async (maPhim: string) => {
  return prisma.phim.findFirst({
    where: {
      MaPhim: maPhim,
      KhaDung: true,
    },
  });
};
