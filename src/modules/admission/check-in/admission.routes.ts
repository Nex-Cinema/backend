import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler';
import { validate } from '../../../middlewares/validate.middleware';
import { checkIn } from './admission.controller';
import { checkInBookingSchema } from './admission.validator';

const router = Router();

router.post('/check-in', validate(checkInBookingSchema), asyncHandler(checkIn));

export default router;
