import { z } from 'zod';

export const checkInBookingSchema = z.object({
  QRPayload: z
    .string()
    .trim()
    .regex(
      /^QR_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      'Mã QR không hợp lệ',
    ),
});

export type CheckInBookingInput = z.infer<typeof checkInBookingSchema>;
