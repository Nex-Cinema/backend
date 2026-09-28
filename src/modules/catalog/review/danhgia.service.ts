import { identityQueries } from '../../identity';
import {
  createReview,
  findReviewsByMovie,
  countReviewsByMovie,
  getMovieRatingStats,
  findActiveMovieById,
} from './danhgia.repository';
import { BadRequestError, NotFoundError } from '../../../utils/errors';

const { findCustomerByAccountId } = identityQueries;
import { CreateReviewInput, MovieReviewQueryInput } from './danhgia.validator';

/**
 * Customer reviews a movie
 */
export const taoDanhGia = async (maTaiKhoan: string, input: CreateReviewInput) => {
  const customer = await findCustomerByAccountId(maTaiKhoan);
  if (!customer) {
    throw new BadRequestError('Tài khoản không phải là khách hàng hợp lệ.');
  }

  const phim = await findActiveMovieById(input.MaPhim);
  if (!phim) {
    throw new NotFoundError(`Không tìm thấy phim đang hoạt động với mã: ${input.MaPhim}`);
  }

  const review = await createReview(
    customer.MaKhachHang,
    input.MaPhim,
    input.SoSao,
    input.BinhLuan,
  );

  return {
    MaDanhGia: review.MaDanhGia,
    MaKhachHang: review.MaKhachHang,
    MaPhim: review.MaPhim,
    SoSao: review.SoSao,
    BinhLuan: review.BinhLuan,
    NgayTao: review.NgayTao,
  };
};

/**
 * Get reviews of a movie with rating stats (DiemTrungBinh and total counts)
 */
export const getDanhSachDanhGia = async (maPhim: string, query: MovieReviewQueryInput) => {
  const phim = await findActiveMovieById(maPhim);
  if (!phim) {
    throw new NotFoundError(`Không tìm thấy phim với mã: ${maPhim}`);
  }

  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const [items, total, stats] = await Promise.all([
    findReviewsByMovie(maPhim, skip, limit),
    countReviewsByMovie(maPhim),
    getMovieRatingStats(maPhim),
  ]);

  const formattedItems = items.map((review) => ({
    MaDanhGia: review.MaDanhGia,
    SoSao: review.SoSao,
    BinhLuan: review.BinhLuan,
    NgayTao: review.NgayTao,
    KhachHang: {
      HoTen: review.KhachHang.TaiKhoan.HoTen,
    },
  }));

  return {
    items: formattedItems,
    ratingSummary: {
      DiemTrungBinh: Number(Number(stats.DiemTrungBinh).toFixed(1)),
      SoLuongDanhGia: stats.SoLuongDanhGia,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
