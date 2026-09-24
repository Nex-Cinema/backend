import { Router } from 'express';
import { Role } from '@prisma/client';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { requireRoles } from '../../../middlewares/role.middleware';
import * as controller from './staffDashboard.controller';

const router = Router();

router.get(
  '/staff/dashboard',
  authMiddleware,
  requireRoles(Role.STAFF),
  controller.getDashboardData,
);

export default router;
