import { Router } from 'express';
import * as controller from './paymentGateway.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { paymentGatewayParamsSchema, updatePaymentGatewaySchema } from './paymentGateway.validator';

const router = Router();

router.get('/', controller.getSettings);
router.patch('/:provider', validate(paymentGatewayParamsSchema, 'params'), validate(updatePaymentGatewaySchema), controller.updateSetting);

export default router;
