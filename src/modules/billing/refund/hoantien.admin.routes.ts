import { Router } from 'express';
import * as controller from './hoantien.controller';
import { validate } from '../../../middlewares/validate.middleware';
import {
  adminRefundQuerySchema,
  adminRefundParamsSchema,
  adminRefundApproveSchema,
  adminRefundRejectSchema,
} from './hoantien.validator';

const router = Router();

/**
 * @route   GET /api/v1/admin/hoan-tien
 * @desc    Lấy danh sách yêu cầu hoàn tiền (phân trang, lọc, tìm kiếm)
 * @access  Private - ADMIN only
 */
router.get(
  '/',
  validate(adminRefundQuerySchema, 'query'),
  controller.getRefundRequestsAdmin,
);

/**
 * @route   GET /api/v1/admin/hoan-tien/:maHoanTien
 * @desc    Xem chi tiết yêu cầu hoàn tiền
 * @access  Private - ADMIN only
 */
router.get(
  '/:maHoanTien',
  validate(adminRefundParamsSchema, 'params'),
  controller.getRefundRequestByIdAdmin,
);

/**
 * @route   PATCH /api/v1/admin/hoan-tien/:maHoanTien/duyet
 * @desc    Duyệt yêu cầu hoàn tiền đang chờ xử lý
 * @access  Private - ADMIN only
 */
router.patch(
  '/:maHoanTien/duyet',
  validate(adminRefundParamsSchema, 'params'),
  validate(adminRefundApproveSchema, 'body'),
  controller.approveRefundRequestAdmin,
);

/**
 * @route   PATCH /api/v1/admin/hoan-tien/:maHoanTien/tu-choi
 * @desc    Từ chối yêu cầu hoàn tiền đang chờ xử lý
 * @access  Private - ADMIN only
 */
router.patch(
  '/:maHoanTien/tu-choi',
  validate(adminRefundParamsSchema, 'params'),
  validate(adminRefundRejectSchema, 'body'),
  controller.rejectRefundRequestAdmin,
);

export default router;
