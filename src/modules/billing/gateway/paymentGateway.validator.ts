import { z } from 'zod';

export const paymentGatewayParamsSchema = z.object({
  provider: z.enum(['PAYOS', 'VNPAY']),
});

export const updatePaymentGatewaySchema = z.object({
  enabled: z.boolean(),
});
