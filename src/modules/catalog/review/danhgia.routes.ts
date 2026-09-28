import { Router } from 'express';
import * as danhGiaController from './danhgia.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { createReviewSchema } from './danhgia.validator';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { requireRoles } from '../../../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

/**
 * @route   POST /api/v1/danh-gia
 * @desc    Đánh giá phim
 * @access  Private - CUSTOMER only
 */
router.post(
  '/',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  validate(createReviewSchema, 'body'),
  danhGiaController.taoDanhGia,
);

export default router;
