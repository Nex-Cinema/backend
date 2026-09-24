import { Router } from 'express';
import { Role } from '@prisma/client';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { requireRoles } from '../../../middlewares/role.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as staffHoSoController from './staffHoSo.controller';
import {
  updateStaffProfileSchema,
  changeStaffPasswordSchema,
} from './staffHoSo.validator';

const router = Router();

/**
 * @route   GET /api/v1/staff/dashboard
 * @desc    Get real-time dashboard data for staff
 * @access  Private (STAFF only)
 */
/**
 * @route   GET /api/v1/staff/ho-so
 * @desc    View authenticated staff member's own profile
 * @access  Private (STAFF only)
 */
router.get(
  '/staff/ho-so',
  authMiddleware,
  requireRoles(Role.STAFF),
  staffHoSoController.getHoSo,
);

/**
 * @route   PUT /api/v1/staff/ho-so
 * @desc    Update authenticated staff member's own profile
 * @access  Private (STAFF only)
 */
router.put(
  '/staff/ho-so',
  authMiddleware,
  requireRoles(Role.STAFF),
  validate(updateStaffProfileSchema, 'body'),
  staffHoSoController.capNhatHoSo,
);

/**
 * @route   PUT /api/v1/staff/doi-mat-khau
 * @desc    Change authenticated staff member's password (revokes all refresh tokens)
 * @access  Private (STAFF only)
 */
router.put(
  '/staff/doi-mat-khau',
  authMiddleware,
  requireRoles(Role.STAFF),
  validate(changeStaffPasswordSchema, 'body'),
  staffHoSoController.doiMatKhau,
);

export default router;
