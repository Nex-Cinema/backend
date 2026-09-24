import { Router } from 'express';
import { Role } from '@prisma/client';
import * as taiKhoanController from './taikhoan.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { requireRoles } from '../../../middlewares/role.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { updateProfileSchema, changePasswordSchema } from './taikhoan.validator';

const router = Router();

/**
 * @route   GET /api/v1/tai-khoan/thong-tin
 * @desc    Lấy thông tin hồ sơ của khách hàng hiện tại
 * @access  Private (CUSTOMER)
 */
router.get(
  '/thong-tin',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  taiKhoanController.getThongTinTaiKhoan,
);

/**
 * @route   PUT /api/v1/tai-khoan/thong-tin
 * @desc    Cập nhật thông tin hồ sơ khách hàng hiện tại
 * @access  Private (CUSTOMER)
 */
router.put(
  '/thong-tin',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  validate(updateProfileSchema),
  taiKhoanController.capNhatThongTinTaiKhoan,
);

/**
 * @route   PUT /api/v1/tai-khoan/doi-mat-khau
 * @desc    Đổi mật khẩu tài khoản khách hàng hiện tại
 * @access  Private (CUSTOMER)
 */
router.put(
  '/doi-mat-khau',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  validate(changePasswordSchema),
  taiKhoanController.doiMatKhau,
);

export default router;
