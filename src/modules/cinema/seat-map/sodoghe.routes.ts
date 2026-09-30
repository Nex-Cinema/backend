import { Router } from 'express';
import * as controller from './sodoghe.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { createSoDoGheSchema, updateSoDoGheSchema } from './sodoghe.validator';

const router = Router();

/**
 * @route   GET /api/v1/admin/so-do-ghe
 * @desc    Lấy danh sách tất cả sơ đồ ghế mẫu
 * @access  Private - ADMIN only
 */
router.get('/', controller.getSoDoGhes);

/**
 * @route   GET /api/v1/admin/so-do-ghe/:maSoDo
 * @desc    Lấy thông tin chi tiết một sơ đồ ghế mẫu
 * @access  Private - ADMIN only
 */
router.get('/:maSoDo', controller.getSoDoGheById);

/**
 * @route   POST /api/v1/admin/so-do-ghe
 * @desc    Tạo sơ đồ ghế mẫu mới
 * @access  Private - ADMIN only
 */
router.post(
  '/',
  validate(createSoDoGheSchema),
  controller.taoSoDoGhe,
);

/**
 * @route   PUT /api/v1/admin/so-do-ghe/:maSoDo
 * @desc    Cập nhật sơ đồ ghế mẫu
 * @access  Private - ADMIN only
 */
router.put(
  '/:maSoDo',
  validate(updateSoDoGheSchema),
  controller.capNhatSoDoGhe,
);

/**
 * @route   DELETE /api/v1/admin/so-do-ghe/:maSoDo
 * @desc    Xóa sơ đồ ghế mẫu (xóa cứng nếu chưa dùng, xóa mềm nếu đang dùng)
 * @access  Private - ADMIN only
 */
router.delete('/:maSoDo', controller.xoaSoDoGhe);

export default router;
