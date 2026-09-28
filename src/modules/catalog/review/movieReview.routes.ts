import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import * as controller from './danhgia.controller';
import { movieReviewParamsSchema, movieReviewQuerySchema } from './danhgia.validator';

const router = Router();

router.get(
  '/:maPhim/danh-gia',
  validate(movieReviewParamsSchema, 'params'),
  validate(movieReviewQuerySchema, 'query'),
  controller.getDanhSachDanhGia,
);

export default router;
