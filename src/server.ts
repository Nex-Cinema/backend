import './config/env'; // Load and validate env vars first
import app from './app';
import { env } from './config/env';
import prisma from './config/prisma';
import { startReleaseExpiredSeatHoldsJob } from './jobs/releaseExpiredSeatHolds.job';
import { ensureDemoBookingData } from './modules/booking';

const PORT = env.PORT;

// ========================
// Graceful Shutdown Handler
// ========================
const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\n🛑 Nhận tín hiệu ${signal}. Đang tắt máy chủ...`);

  try {
    await prisma.$disconnect();
    console.log('✅ Đã ngắt kết nối Prisma');
  } catch (error) {
    console.error('❌ Lỗi khi ngắt kết nối Prisma:', error);
  }

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ========================
// Start Server
// ========================
const startServer = async (): Promise<void> => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Kết nối cơ sở dữ liệu thành công');

    if (env.SEED_DEMO_DATA_ON_START) {
      await ensureDemoBookingData();
    }

    app.listen(PORT, () => {
      if (env.NODE_ENV !== 'test') {
        startReleaseExpiredSeatHoldsJob();
      }
      console.log('');
      console.log('🎬 ================================================');
      console.log('   Cinema Booking System Backend');
      console.log('🎬 ================================================');
      console.log(`🚀 Máy chủ đang chạy tại: http://localhost:${PORT}`);
      console.log(`📡 API Prefix: ${env.API_PREFIX}`);
      console.log(`🌍 Môi trường: ${env.NODE_ENV}`);
      console.log('');
      console.log('📋 Các endpoint chính:');
      console.log(`   GET  http://localhost:${PORT}${env.API_PREFIX}/health`);
      console.log(`   POST http://localhost:${PORT}${env.API_PREFIX}/auth/register`);
      console.log(`   POST http://localhost:${PORT}${env.API_PREFIX}/auth/login`);
      console.log(`   GET  http://localhost:${PORT}${env.API_PREFIX}/phim`);
      console.log('🎬 ================================================');
    });
  } catch (error) {
    console.error('❌ Không thể khởi động máy chủ:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();
