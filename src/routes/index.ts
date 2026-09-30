import { Router, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { sendSuccess } from '../utils/response';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRoles } from '../middlewares/role.middleware';

// ============================================================
// Module routes — feature-based structure
// ============================================================
import { authRouter, accountRouter, userAdminRouter } from '../modules/identity';
import { movieRouter, movieAdminRouter, reviewRouter, movieReviewRouter } from '../modules/catalog';
import { publicRouter as showtimeRouter, adminRouter as showtimeAdminRouter } from '../modules/showtime';
import { reservationRouter, historyRouter } from '../modules/booking';
import {
  paymentRouter,
  paymentGatewayPublicRouter,
  paymentGatewayAdminRouter,
  refundRouter,
  refundAdminRouter,
  transactionAdminRouter,
  counterSaleAdminRouter,
} from '../modules/billing';
import { adminRouter as reportingAdminRouter } from '../modules/reporting';
import { adminRouter as admissionAdminRouter } from '../modules/admission';

// Admin-only routes
import { metadataAdminRouter, roomAdminRouter, seatMapAdminRouter } from '../modules/cinema';
import { adminRouter as operationalSettingsAdminRouter } from '../modules/operational-settings';

const router = Router();

// ========================
// Health Check
// ========================
router.get('/health', (req: Request, res: Response) => {
  sendSuccess(res, 'Máy chủ đang hoạt động bình thường', {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
  });
});

// ========================
// Public / Customer Routes
// ========================
router.use('/auth', authRouter);
router.use('/phim', movieReviewRouter, movieRouter);
router.use('/suat-chieu', showtimeRouter);
router.use('/dat-ve', reservationRouter);
router.use('/payment', paymentGatewayPublicRouter, paymentRouter);
router.use('/lich-su-giao-dich', historyRouter);
router.use('/danh-gia', reviewRouter);
router.use('/hoan-tien', refundRouter);
router.use('/tai-khoan', accountRouter);

// ========================
// Admin Routes (auth + ADMIN role applied globally)
// ========================
const adminRouter = Router();
adminRouter.use(authMiddleware);
adminRouter.use(requireRoles(Role.ADMIN));

adminRouter.use('/', metadataAdminRouter);
adminRouter.use('/phong-chieu', roomAdminRouter);
adminRouter.use('/suat-chieu', showtimeAdminRouter);
adminRouter.use('/phim', movieAdminRouter);
adminRouter.use('/so-do-ghe', seatMapAdminRouter);
adminRouter.use('/nguoi-dung', userAdminRouter);
adminRouter.use('/giao-dich', transactionAdminRouter);
adminRouter.use('/thong-ke', reportingAdminRouter);
adminRouter.use('/hoan-tien', refundAdminRouter);
adminRouter.use('/cong-thanh-toan', paymentGatewayAdminRouter);
adminRouter.use('/cau-hinh-van-hanh', operationalSettingsAdminRouter);
adminRouter.use('/admission', admissionAdminRouter);
adminRouter.use('/ban-ve-tai-quay', counterSaleAdminRouter);

router.use('/admin', adminRouter);

export default router;
