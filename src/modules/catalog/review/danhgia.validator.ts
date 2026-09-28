import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../shared/pagination';
import { REVIEW_LIMITS } from './review.constants';

export const createReviewSchema = z.object({
  MaPhim: z.string({
    required_error: 'Mã phim là bắt buộc',
  }).uuid('Mã phim phải là UUID hợp lệ'),
  SoSao: z.coerce.number({
    required_error: 'Số sao đánh giá là bắt buộc',
  }).int('Số sao phải là số nguyên')
    .min(REVIEW_LIMITS.minRating, `Số sao tối thiểu là ${REVIEW_LIMITS.minRating}`)
    .max(REVIEW_LIMITS.maxRating, `Số sao tối đa là ${REVIEW_LIMITS.maxRating}`),
  BinhLuan: z.string().max(
    REVIEW_LIMITS.maxCommentLength,
    `Bình luận không quá ${REVIEW_LIMITS.maxCommentLength} ký tự`,
  ).optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const movieReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type MovieReviewQueryInput = z.infer<typeof movieReviewQuerySchema>;
export const movieReviewParamsSchema = z.object({
  maPhim: z.string({
    required_error: 'Mã phim là bắt buộc',
  }).uuid('Mã phim phải là UUID hợp lệ'),
});
export type MovieReviewParamsInput = z.infer<typeof movieReviewParamsSchema>;
