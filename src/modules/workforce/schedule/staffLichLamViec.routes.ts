import { Router } from 'express';
import { Role } from '@prisma/client';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { requireRoles } from '../../../middlewares/role.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as staffLichLamViecController from './staffLichLamViec.controller';
import {
  shiftTemplateQuerySchema,
  myScheduleQuerySchema,
  registerShiftSchema,
  cancelShiftParamSchema,
} from './staffLichLamViec.validator';

const router = Router();

/**
 * @route   GET /api/v1/staff/lich-lam-viec/ca-lam
 * @desc    View available shift templates and capacity by date
 * @access  Private (STAFF only)
 */
router.get(
  '/staff/lich-lam-viec/ca-lam',
  authMiddleware,
  requireRoles(Role.STAFF),
  validate(shiftTemplateQuerySchema, 'query'),
  staffLichLamViecController.getCaLam,
);

/**
 * @route   GET /api/v1/staff/lich-lam-viec/cua-toi
 * @desc    View own registered schedule
 * @access  Private (STAFF only)
 */
router.get(
  '/staff/lich-lam-viec/cua-toi',
  authMiddleware,
  requireRoles(Role.STAFF),
  validate(myScheduleQuerySchema, 'query'),
  staffLichLamViecController.getLichCuaToi,
);

/**
 * @route   POST /api/v1/staff/lich-lam-viec/dang-ky
 * @desc    Register for a shift on a specific date
 * @access  Private (STAFF only)
 */
router.post(
  '/staff/lich-lam-viec/dang-ky',
  authMiddleware,
  requireRoles(Role.STAFF),
  validate(registerShiftSchema, 'body'),
  staffLichLamViecController.dangKyCa,
);

/**
 * @route   PATCH /api/v1/staff/lich-lam-viec/:maChiTietCa/huy
 * @desc    Cancel own registered shift (soft-delete)
 * @access  Private (STAFF only)
 */
router.patch(
  '/staff/lich-lam-viec/:maChiTietCa/huy',
  authMiddleware,
  requireRoles(Role.STAFF),
  validate(cancelShiftParamSchema, 'params'),
  staffLichLamViecController.huyCa,
);

export default router;
