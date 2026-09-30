import nodemailer from 'nodemailer';
import { env } from '../config/env';

/**
 * Sends a password reset OTP email to a user.
 * If SMTP configuration is missing or invalid, logs to console in development.
 */
export const sendResetOtpEmail = async (
  email: string,
  otp: string,
  expiresInMinutes: number,
): Promise<boolean> => {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } = env;

  // Check if SMTP is configured
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('⚠️ SMTP config is missing/incomplete. Logging OTP to console instead:');
    console.log(`🔑 [OTP Reset Password for ${email}]: ${otp}`);
    return true; // Return true so dev testing doesn't block or throw errors
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT || (SMTP_SECURE ? 465 : 587),
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const mailOptions = {
      from: SMTP_FROM,
      to: email,
      subject: 'Mã xác nhận đặt lại mật khẩu UIT Cinema',
      text: `Xin chào,\n\nMã xác nhận đặt lại mật khẩu UIT Cinema của bạn là: ${otp}\n\nMã này sẽ hết hạn sau ${expiresInMinutes} phút.\n\nNếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.\n\nTrân trọng,\nUIT Cinema`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
          <h2 style="color: #ef4444; text-transform: uppercase; letter-spacing: 1px;">UIT Cinema</h2>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;" />
          <p>Xin chào,</p>
          <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email này.</p>
          <p>Mã xác nhận của bạn là:</p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #ef4444; font-family: monospace;">${otp}</span>
          </div>
          <p style="color: #64748b; font-size: 13px;">Mã này sẽ <strong>hết hạn sau ${expiresInMinutes} phút</strong>.</p>
          <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này và mật khẩu của bạn sẽ được giữ nguyên.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 20px; margin-bottom: 20px;" />
          <p style="color: #94a3b8; font-size: 11px;">Đây là email tự động, vui lòng không phản hồi lại email này.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('❌ Failed to send reset OTP email:', error);
    // In development mode, fallback to logging the OTP instead of failing the request
    if (env.isDevelopment()) {
      console.log(`🔑 [OTP Reset Password Fallback for ${email}]: ${otp}`);
      return true;
    }
    throw error;
  }
};
