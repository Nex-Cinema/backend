import { PhuongThucThanhToan, TrangThaiGiaoDich } from '@prisma/client';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { BadRequestError } from '../utils/errors';

export const PAYMENT_PROVIDERS = ['PAYOS', 'VNPAY'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

const hasRealValue = (value: string) => Boolean(value && !/^your_/i.test(value));

const providerMetadata = (provider: PaymentProvider) => {
  if (provider === 'PAYOS') {
    return {
      provider,
      label: 'PayOS',
      configured: [env.PAYOS_CLIENT_ID, env.PAYOS_API_KEY, env.PAYOS_CHECKSUM_KEY].every(hasRealValue),
      environment: env.isProduction() ? 'production' : 'sandbox',
      endpoints: {
        returnUrl: env.PAYOS_RETURN_URL || `${env.FRONTEND_URL}/profile?payment=success`,
        cancelUrl: env.PAYOS_CANCEL_URL || `${env.FRONTEND_URL}/profile?payment=cancel`,
        webhookUrl: `${env.BACKEND_PUBLIC_URL}${env.API_PREFIX}/payment/payos/webhook`,
      },
      requiredSecrets: ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'],
    };
  }

  return {
    provider,
    label: 'VNPay',
    configured: [env.VNPAY_TMN_CODE, env.VNPAY_HASH_SECRET].every(hasRealValue),
    environment: env.VNPAY_PAYMENT_URL.includes('sandbox') ? 'sandbox' : 'production',
    endpoints: {
      callbackUrl: env.VNPAY_CALLBACK_URL || `${env.BACKEND_PUBLIC_URL}${env.API_PREFIX}/payment/vnpay/return`,
      frontendReturnUrl: env.VNPAY_FRONTEND_RETURN_URL || `${env.FRONTEND_URL}/payment/vnpay-return`,
      ipnUrl: env.VNPAY_IPN_URL || `${env.BACKEND_PUBLIC_URL}${env.API_PREFIX}/payment/vnpay/ipn`,
    },
    requiredSecrets: ['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET'],
  };
};

const ensureSettings = async () => {
  await prisma.cauHinhCongThanhToan.createMany({
    data: PAYMENT_PROVIDERS.map((provider) => ({ NhaCungCap: provider, KichHoat: true })),
    skipDuplicates: true,
  });
};

export const getPaymentGatewaySettings = async () => {
  await ensureSettings();
  const [settings, transactionStats] = await Promise.all([
    prisma.cauHinhCongThanhToan.findMany({ where: { NhaCungCap: { in: [...PAYMENT_PROVIDERS] } } }),
    prisma.giaoDich.groupBy({
      by: ['PhuongThuc', 'TrangThai'],
      where: { PhuongThuc: { in: [PhuongThucThanhToan.PAYOS, PhuongThucThanhToan.VNPAY] } },
      _count: { _all: true },
    }),
  ]);

  return PAYMENT_PROVIDERS.map((provider) => {
    const metadata = providerMetadata(provider);
    const setting = settings.find((item) => item.NhaCungCap === provider);
    const counts = transactionStats.filter((item) => item.PhuongThuc === provider);
    const count = (status: TrangThaiGiaoDich) => counts.find((item) => item.TrangThai === status)?._count._all ?? 0;
    return {
      ...metadata,
      enabled: setting?.KichHoat ?? true,
      ready: Boolean(setting?.KichHoat ?? true) && metadata.configured,
      updatedAt: setting?.NgayCapNhat ?? null,
      transactions: {
        pending: count(TrangThaiGiaoDich.CHO_XU_LY),
        succeeded: count(TrangThaiGiaoDich.THANH_CONG),
        failed: count(TrangThaiGiaoDich.THAT_BAI),
      },
    };
  });
};

export const updatePaymentGatewaySetting = async (provider: PaymentProvider, enabled: boolean) => {
  if (enabled && !providerMetadata(provider).configured) {
    throw new BadRequestError(`Không thể bật ${provider}: credential máy chủ chưa được cấu hình đầy đủ.`);
  }
  await prisma.cauHinhCongThanhToan.upsert({
    where: { NhaCungCap: provider },
    update: { KichHoat: enabled },
    create: { NhaCungCap: provider, KichHoat: enabled },
  });
  return (await getPaymentGatewaySettings()).find((item) => item.provider === provider);
};

export const getPublicPaymentGateways = async () => {
  await ensureSettings();
  const settings = await prisma.cauHinhCongThanhToan.findMany({ where: { NhaCungCap: { in: [...PAYMENT_PROVIDERS] } } });
  return PAYMENT_PROVIDERS.map((provider) => {
    const metadata = providerMetadata(provider);
    const enabled = settings.find((item) => item.NhaCungCap === provider)?.KichHoat ?? true;
    return { provider, label: metadata.label, available: enabled && metadata.configured, environment: metadata.environment };
  });
};

export const assertPaymentGatewayAvailable = async (provider: PaymentProvider) => {
  const setting = await prisma.cauHinhCongThanhToan.findUnique({ where: { NhaCungCap: provider } });
  const metadata = providerMetadata(provider);
  if (setting && !setting.KichHoat) throw new BadRequestError(`Cổng ${metadata.label} đang tạm ngưng.`);
  if (!metadata.configured) throw new BadRequestError(`Cổng ${metadata.label} chưa được cấu hình đầy đủ trên máy chủ.`);
};
