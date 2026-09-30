import { Router } from 'express';
import { getPublicSettings } from './paymentGateway.controller';

const router = Router();
router.get('/gateways', getPublicSettings);

export default router;
