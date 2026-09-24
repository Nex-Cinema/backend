import { Router } from 'express';
import * as controller from './thongke.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { statsQuerySchema } from './thongke.validator';

const router = Router();

/**
 * @route   GET /api/v1/admin/thong-ke/doanh-thu
 * @desc    Thống kê doanh thu theo thời gian, phim, phương thức thanh toán
 * @access  Private - ADMIN/MANAGER only
 */
router.get(
  '/doanh-thu',
  validate(statsQuerySchema, 'query'),
  controller.getDoanhThuStats,
);

/**
 * @route   GET /api/v1/admin/thong-ke/ti-le-ghe
 * @desc    Thống kê tỉ lệ lấp đầy ghế theo suất chiếu
 * @access  Private - ADMIN/MANAGER only
 */
router.get(
  '/ti-le-ghe',
  validate(statsQuerySchema, 'query'),
  controller.getFillRateStats,
);

export default router;
