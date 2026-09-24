import { Router } from 'express';
import { Role } from '@prisma/client';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { requireRoles } from '../../../middlewares/role.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import * as staffSoatVeController from './staffSoatVe.controller';
import { validateTicketSchema, checkInSchema, historyQuerySchema } from './staffSoatVe.validator';

const router = Router();

/**
 * @route   POST /api/v1/staff/soat-ve/kiem-tra
 * @desc    Validate ticket before actual check-in
 * @access  Private (STAFF only)
 */
router.post(
  '/staff/soat-ve/kiem-tra',
  authMiddleware,
  requireRoles(Role.STAFF),
  validate(validateTicketSchema, 'body'),
  staffSoatVeController.kiemTraVe,
);

/**
 * @route   POST /api/v1/staff/soat-ve/check-in
 * @desc    Mark a ticket as checked in
 * @access  Private (STAFF only)
 */
router.post(
  '/staff/soat-ve/check-in',
  authMiddleware,
  requireRoles(Role.STAFF),
  validate(checkInSchema, 'body'),
  staffSoatVeController.checkInVe,
);

/**
 * @route   GET /api/v1/staff/soat-ve/lich-su
 * @desc    View recent ticket check-in logs history
 * @access  Private (STAFF only)
 */
router.get(
  '/staff/soat-ve/lich-su',
  authMiddleware,
  requireRoles(Role.STAFF),
  validate(historyQuerySchema, 'query'),
  staffSoatVeController.getLichSuSoatVe,
);

export default router;
