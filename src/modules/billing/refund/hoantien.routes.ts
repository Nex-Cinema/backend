import { Router } from 'express';
import * as hoanTienController from './hoantien.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { refundRequestSchema, refundListQuerySchema } from './hoantien.validator';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { requireRoles } from '../../../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

/**
 * @route   POST /api/v1/hoan-tien/yeu-cau
 * @desc    Khách hàng gửi yêu cầu hoàn tiền
 * @access  Private - CUSTOMER only
 */
router.post(
  '/yeu-cau',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  validate(refundRequestSchema, 'body'),
  hoanTienController.yeuCauHoanTien,
);

/**
 * @route   GET /api/v1/hoan-tien/cua-toi
 * @desc    Khách hàng xem danh sách yêu cầu hoàn tiền của mình
 * @access  Private - CUSTOMER only
 */
router.get(
  '/cua-toi',
  authMiddleware,
  requireRoles(Role.CUSTOMER),
  validate(refundListQuerySchema, 'query'),
  hoanTienController.getHoanTienCuaToi,
);

export default router;
