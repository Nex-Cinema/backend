import prisma from '../../../config/prisma';

/**
 * Create a new password reset OTP record
 */
export const createPasswordResetOtp = async (data: {
  MaTaiKhoan: string;
  OtpHash: string;
  HetHanLuc: Date;
}) => {
  return prisma.passwordResetOtp.create({
    data: {
      MaTaiKhoan: data.MaTaiKhoan,
      OtpHash: data.OtpHash,
      HetHanLuc: data.HetHanLuc,
      SoLanThu: 0,
      DaSuDung: false,
    },
  });
};

/**
 * Invalidate all previous unused OTPs for a given account
 */
export const invalidatePreviousOtps = async (maTaiKhoan: string) => {
  return prisma.passwordResetOtp.updateMany({
    where: {
      MaTaiKhoan: maTaiKhoan,
      DaSuDung: false,
    },
    data: {
      DaSuDung: true,
    },
  });
};

/**
 * Find the latest active (unused & non-expired) OTP for a given account
 */
export const findActiveOtpByAccountId = async (maTaiKhoan: string) => {
  return prisma.passwordResetOtp.findFirst({
    where: {
      MaTaiKhoan: maTaiKhoan,
      DaSuDung: false,
      HetHanLuc: {
        gt: new Date(),
      },
    },
    orderBy: {
      NgayTao: 'desc',
    },
  });
};

/**
 * Increment the attempt count for a specific OTP
 */
export const incrementOtpAttempts = async (maOtp: string) => {
  return prisma.passwordResetOtp.update({
    where: { MaOtp: maOtp },
    data: {
      SoLanThu: {
        increment: 1,
      },
    },
  });
};

/**
 * Mark a specific OTP as used (invalidated)
 */
export const markOtpAsUsed = async (maOtp: string) => {
  return prisma.passwordResetOtp.update({
    where: { MaOtp: maOtp },
    data: {
      DaSuDung: true,
    },
  });
};
