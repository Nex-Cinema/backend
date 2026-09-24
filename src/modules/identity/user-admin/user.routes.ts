import { Router } from 'express';
import * as controller from './user.controller';
import { validate } from '../../../middlewares/validate.middleware';
import {
  createUserSchema,
  updateUserSchema,
  adminChangePasswordSchema,
  userQuerySchema,
} from './user.validator';

const router = Router();

/**
 * @route   GET /api/v1/admin/nguoi-dung
 * @desc    Lấy danh sách người dùng (phân trang, lọc, tìm kiếm)
 * @access  Private - ADMIN only
 */
router.get(
  '/',
  validate(userQuerySchema, 'query'),
  controller.getDanhSachNguoiDung,
);

/**
 * @route   GET /api/v1/admin/nguoi-dung/:maTaiKhoan
 * @desc    Xem chi tiết thông tin một người dùng
 * @access  Private - ADMIN only
 */
router.get('/:maTaiKhoan', controller.getChiTietNguoiDung);

/**
 * @route   POST /api/v1/admin/nguoi-dung
 * @desc    Tạo mới tài khoản người dùng (ADMIN, STAFF hoặc CUSTOMER)
 * @access  Private - ADMIN only
 */
router.post(
  '/',
  validate(createUserSchema),
  controller.taoNguoiDung,
);

/**
 * @route   PUT /api/v1/admin/nguoi-dung/:maTaiKhoan
 * @desc    Cập nhật thông tin cá nhân/chức vụ của người dùng
 * @access  Private - ADMIN only
 */
router.put(
  '/:maTaiKhoan',
  validate(updateUserSchema),
  controller.capNhatNguoiDung,
);

/**
 * @route   PUT/PATCH /api/v1/admin/nguoi-dung/:maTaiKhoan/doi-mat-khau
 * @desc    Admin đặt lại mật khẩu cho người dùng
 * @access  Private - ADMIN only
 */
router.put(
  '/:maTaiKhoan/doi-mat-khau',
  validate(adminChangePasswordSchema),
  controller.adminDoiMatKhau,
);
router.patch(
  '/:maTaiKhoan/doi-mat-khau',
  validate(adminChangePasswordSchema),
  controller.adminDoiMatKhau,
);

/**
 * @route   DELETE /api/v1/admin/nguoi-dung/:maTaiKhoan
 * @desc    Xóa tài khoản (xóa cứng nếu chưa liên kết, xóa mềm nếu đã có lịch sử)
 * @access  Private - ADMIN only
 */
router.delete('/:maTaiKhoan', controller.xoaNguoiDung);

export default router;
