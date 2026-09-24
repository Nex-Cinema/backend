import { Router } from 'express';
import * as controller from './suatchieu.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { showtimeIdParamSchema } from './suatchieu.validator';

const router = Router();

/**
 * @route   GET /api/v1/suat-chieu
 * @desc    Lấy danh sách suất chiếu (có thể lọc theo maPhim, maPhong, ngayChieu)
 * @access  Public
 */
router.get('/', controller.getDanhSachSuatChieu);

/**
 * @route   GET /api/v1/suat-chieu/:maSuatChieu
 * @desc    Lấy thông tin chi tiết một suất chiếu
 * @access  Public
 */
router.get('/:maSuatChieu', controller.getChiTietSuatChieu);

/**
 * @route   GET /api/v1/suat-chieu/:maSuatChieu/ghe
 * @desc    Lấy sơ đồ ghế và trạng thái giữ ghế của suất chiếu
 * @access  Public
 */
router.get(
  '/:maSuatChieu/ghe',
  validate(showtimeIdParamSchema, 'params'),
  controller.getSeatMap,
);

export default router;
