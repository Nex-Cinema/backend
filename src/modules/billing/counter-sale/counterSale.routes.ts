import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware';
import {
  counterPayosBookingParamSchema,
  counterPayosStatusParamSchema,
  counterSaleSchema,
} from './counterSale.validator';
import { getCounterPayosStatus, recreateCounterPayosLink, sellAtCounter } from './counterSale.controller';

const router = Router();

router.post('/', validate(counterSaleSchema), sellAtCounter);
router.post('/:maPhieuDat/payos', validate(counterPayosBookingParamSchema, 'params'), recreateCounterPayosLink);
router.get('/payos/:maGiaoDich/status', validate(counterPayosStatusParamSchema, 'params'), getCounterPayosStatus);

export default router;
