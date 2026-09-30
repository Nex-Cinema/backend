import { Request, Response } from 'express';
import { sendSuccess } from '../../../utils/response';
import { checkInBooking } from './admission.service';
import { CheckInBookingInput } from './admission.validator';

export const checkIn = async (req: Request, res: Response) => {
  const result = await checkInBooking(req.body as CheckInBookingInput);
  sendSuccess(res, 'Check-in thành công', result);
};
