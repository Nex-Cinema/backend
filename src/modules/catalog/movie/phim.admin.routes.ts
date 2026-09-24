import { Router } from 'express';
import * as phimController from './phim.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { createPhimSchema, updatePhimSchema } from './phim.validator';

const router = Router();

/**
 * @route   POST /api/v1/admin/phim
 * @desc    Tạo phim mới
 * @access  Private - ADMIN only
 */
router.post(
  '/',
  validate(createPhimSchema),
  phimController.taoPhim,
);

/**
 * @route   PUT /api/v1/admin/phim/:maPhim
 * @desc    Cập nhật toàn bộ thông tin phim
 * @access  Private - ADMIN only
 */
router.put(
  '/:maPhim',
  validate(updatePhimSchema),
  phimController.capNhatPhim,
);

/**
 * @route   PATCH /api/v1/admin/phim/:maPhim/soft-delete
 * @desc    Ẩn phim (soft delete - set KhaDung = false)
 * @access  Private - ADMIN only
 */
router.patch(
  '/:maPhim/soft-delete',
  phimController.anPhim,
);

/**
 * @route   PATCH /api/v1/admin/phim/:maPhim/restore
 * @desc    Khôi phục phim (set KhaDung = true)
 * @access  Private - ADMIN only
 */
router.patch(
  '/:maPhim/restore',
  phimController.khoiPhucPhim,
);

/**
 * @route   DELETE /api/v1/admin/phim/:maPhim
 * @desc    Xóa vĩnh viễn phim khỏi cơ sở dữ liệu
 * @access  Private - ADMIN only
 */
router.delete(
  '/:maPhim',
  phimController.xoaPhim,
);

export default router;
