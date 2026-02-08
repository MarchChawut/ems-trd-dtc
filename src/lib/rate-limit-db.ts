/**
 * ==================================================
 * Database Rate Limiting - ระบบ Rate Limiting ด้วย Database
 * ==================================================
 * ใช้ฐานข้อมูลแทน in-memory Map เพื่อรองรับ multi-instance
 * 
 * การใช้งาน:
 * import { dbRateLimit } from '@/lib/rate-limit-db';
 * const isLimited = await dbRateLimit.isRateLimited(identifier);
 */

import { prisma } from './prisma';
import { logger } from './logger';

// การตั้งค่า
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 นาที

/**
 * Database Rate Limiter Class
 */
class DatabaseRateLimiter {
  /**
   * ตรวจสอบว่า identifier ถูกบล็อกหรือไม่
   */
  async isRateLimited(identifier: string): Promise<boolean> {
    try {
      // หา login attempts ล่าสุดที่ยังไม่ expired
      const since = new Date(Date.now() - LOCKOUT_DURATION);
      
      const attempts = await prisma.loginAttempt.count({
        where: {
          ipAddress: identifier,
          success: false,
          createdAt: {
            gte: since,
          },
        },
      });
      
      return attempts >= MAX_LOGIN_ATTEMPTS;
    } catch (error) {
      logger.error('Rate limit check failed', { error, identifier });
      // ถ้าตรวจสอบไม่ได้ ให้ผ่านไปก่อน (fail open) เพื่อไม่ block ผู้ใช้
      return false;
    }
  }

  /**
   * บันทึกการพยายามเข้าสู่ระบบ (ใช้ loginAttempt.create โดยตรง)
   * ฟังก์ชันนี้เพิ่มความสะดวกในการดึงข้อมูล
   */
  async getLoginAttempts(identifier: string): Promise<{
    count: number;
    remainingAttempts: number;
    isLocked: boolean;
    lastAttempt: Date | null;
  }> {
    try {
      const since = new Date(Date.now() - LOCKOUT_DURATION);
      
      // ดึงการพยายามล่าสุด
      const [count, lastAttempt] = await Promise.all([
        prisma.loginAttempt.count({
          where: {
            ipAddress: identifier,
            success: false,
            createdAt: {
              gte: since,
            },
          },
        }),
        prisma.loginAttempt.findFirst({
          where: {
            ipAddress: identifier,
            success: false,
            createdAt: {
              gte: since,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            createdAt: true,
          },
        }),
      ]);
      
      const isLocked = count >= MAX_LOGIN_ATTEMPTS;
      const remainingAttempts = Math.max(0, MAX_LOGIN_ATTEMPTS - count);
      
      return {
        count,
        remainingAttempts,
        isLocked,
        lastAttempt: lastAttempt?.createdAt || null,
      };
    } catch (error) {
      logger.error('Get login attempts failed', { error, identifier });
      return {
        count: 0,
        remainingAttempts: MAX_LOGIN_ATTEMPTS,
        isLocked: false,
        lastAttempt: null,
      };
    }
  }

  /**
   * ล้างข้อมูลการพยายามเข้าสู่ระบบ (เมื่อ login สำเร็จ)
   * ลบเฉพาะ records ที่เก่าเกิน LOCKOUT_DURATION
   */
  async clearAttempts(identifier: string): Promise<void> {
    try {
      const since = new Date(Date.now() - LOCKOUT_DURATION);
      
      await prisma.loginAttempt.deleteMany({
        where: {
          ipAddress: identifier,
          createdAt: {
            gte: since,
          },
        },
      });
      
      logger.info('Cleared login attempts', { identifier });
    } catch (error) {
      logger.error('Clear login attempts failed', { error, identifier });
    }
  }
}

// Export singleton
export const dbRateLimit = new DatabaseRateLimiter();

// Export settings for reference
export { MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION };
