import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import * as controller from './operationalSettings.controller';
import { updateOperationalSettingsSchema } from './operationalSettings.validator';

const router = Router();

router.get('/', controller.getSettings);
router.patch('/', validate(updateOperationalSettingsSchema), controller.updateSettings);

export default router;
