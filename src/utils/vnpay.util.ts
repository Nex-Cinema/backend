import crypto from 'crypto';

/**
 * Normalizes a forwarded client address to the value expected by VNPay.
 */
export const normalizeIp = (ip?: string): string => {
  if (!ip || ip === '::1' || ip.includes('::ffff:127.0.0.1')) return '127.0.0.1';
  return ip.split(',')[0].trim().replace('::ffff:', '');
};

/**
 * Sorts and encodes VNPay parameters using application/x-www-form-urlencoded rules.
 */
export const sortVNPayParams = (params: Record<string, unknown>): Record<string, string> => {
  return Object.keys(params)
    .sort()
    .reduce<Record<string, string>>((result, key) => {
      const value = params[key];
      if (value !== undefined && value !== null && value !== '') {
        const encodedKey = encodeURIComponent(key).replace(/%20/g, '+');
        const encodedValue = encodeURIComponent(String(value)).replace(/%20/g, '+');
        result[encodedKey] = encodedValue;
      }
      return result;
    }, {});
};

/**
 * Serializes already encoded VNPay parameters without encoding them a second time.
 */
export const stringifyVNPayParams = (params: Record<string, string>): string => {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
};

export const buildVNPaySignData = (params: Record<string, unknown>): string => {
  return stringifyVNPayParams(sortVNPayParams(params));
};

export const generateVNPaySecureHash = (
  params: Record<string, unknown>,
  secret: string,
): string => {
  return crypto
    .createHmac('sha512', secret)
    .update(Buffer.from(buildVNPaySignData(params), 'utf-8'))
    .digest('hex');
};

export const verifyVNPaySignature = (
  queryParams: Record<string, unknown>,
  secret: string,
): boolean => {
  const receivedHash = queryParams.vnp_SecureHash;
  if (typeof receivedHash !== 'string' || !/^[a-fA-F0-9]{128}$/.test(receivedHash)) return false;

  const params = { ...queryParams };
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  const calculatedHash = generateVNPaySecureHash(params, secret);
  const receivedBuffer = Buffer.from(receivedHash, 'hex');
  const calculatedBuffer = Buffer.from(calculatedHash, 'hex');

  return receivedBuffer.length === calculatedBuffer.length
    && crypto.timingSafeEqual(receivedBuffer, calculatedBuffer);
};
