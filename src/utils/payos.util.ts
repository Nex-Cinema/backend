import { PayOS } from '@payos/node';
import { env } from '../config/env';

if (!env.PAYOS_CLIENT_ID || !env.PAYOS_API_KEY || !env.PAYOS_CHECKSUM_KEY) {
  console.warn('⚠️ Cảnh báo: Biến môi trường PayOS chưa được cấu hình đầy đủ.');
}

export const payOS = new PayOS({
  clientId: env.PAYOS_CLIENT_ID,
  apiKey: env.PAYOS_API_KEY,
  checksumKey: env.PAYOS_CHECKSUM_KEY,
});
