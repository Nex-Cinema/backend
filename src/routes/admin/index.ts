import { Router } from 'express';
import { Role } from '@prisma/client';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/role.middleware';
import metadataRoutes from './metadata.routes';
import phongChieuRoutes from './phongchieu.routes';
import suatChieuRoutes from './suatchieu.routes';
import phimRoutes from './phim.routes';
import soDoGheRoutes from './sodoghe.routes';
import userRoutes from './user.routes';
import giaoDichRoutes from './giaodich.routes';
import caLamViecRoutes from './calamviec.routes';
import thongKeRoutes from './thongke.routes';
import hoanTienRoutes from './hoantien.routes';
import paymentGatewayRoutes from './paymentGateway.routes';

const router = Router();

// Apply auth and require admin role for all admin sub-routes
router.use(authMiddleware);
router.use(requireRoles(Role.ADMIN));

// Mount sub-routers
router.use('/', metadataRoutes);
router.use('/phong-chieu', phongChieuRoutes);
router.use('/suat-chieu', suatChieuRoutes);
router.use('/phim', phimRoutes);
router.use('/so-do-ghe', soDoGheRoutes);
router.use('/nguoi-dung', userRoutes);
router.use('/giao-dich', giaoDichRoutes);
router.use('/ca-lam-viec', caLamViecRoutes);
router.use('/thong-ke', thongKeRoutes);
router.use('/hoan-tien', hoanTienRoutes);
router.use('/cong-thanh-toan', paymentGatewayRoutes);

export default router;
