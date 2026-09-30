import { seatHoldOperations } from '../modules/showtime';

const { releaseExpiredHolds } = seatHoldOperations;

let intervalId: NodeJS.Timeout | null = null;

/**
 * Executes hold release task
 */
export const runReleaseExpiredSeatHolds = async (): Promise<number> => {
  try {
    const now = new Date();
    const result = await releaseExpiredHolds(now);
    
    if (result.count > 0 && process.env.NODE_ENV === 'development') {
      console.log(`[Job] Đã giải phóng ${result.count} ghế hết hạn giữ.`);
    }
    return result.count;
  } catch (error) {
    console.error('[Job] Lỗi giải phóng ghế hết hạn giữ:', error);
    return 0;
  }
};

/**
 * Starts the 1-minute interval job to release expired seat holds
 */
export const startReleaseExpiredSeatHoldsJob = (): void => {
  if (intervalId) return;

  // Run immediately on boot to handle startup checks
  runReleaseExpiredSeatHolds();

  // Schedule to run every 1 minute (60,000 ms)
  intervalId = setInterval(async () => {
    await runReleaseExpiredSeatHolds();
  }, 60000);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('⏰ [Job] Đã kích hoạt job giải phóng ghế hết hạn giữ (chu kỳ 1 phút).');
  }
};

/**
 * Stops the job (useful for tests or graceful shutdown)
 */
export const stopReleaseExpiredSeatHoldsJob = (): void => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};
