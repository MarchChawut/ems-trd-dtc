/**
 * ==================================================
 * Authentication Helpers - ฟังก์ชันช่วยเหลือการตรวจสอบสิทธิ์
 * ==================================================
 * ไฟล์นี้รวมฟังก์ชันสำหรับตรวจสอบ session และสิทธิ์การใช้งาน
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { SessionUser, UserRole } from '@/types';

/**
 * ผลลัพธ์การตรวจสอบการเข้าสู่ระบบ
 */
interface AuthResult {
  success: boolean;
  user?: SessionUser;
  error?: string;
  message?: string;
  status?: number;
}

// ============================================================
// Session Cache (in-memory, short TTL)
// ============================================================
// 60 วินาทีพอที่จะลด DB round-trip บน burst traffic
// แต่สั้นพอที่ disabled accounts จะ revoked เร็ว
const SESSION_CACHE_TTL_MS = 60_000;
const SESSION_CACHE_MAX = 5000;

interface CachedSession {
  user: SessionUser;
  expiresAt: number;       // timestamp ที่ session หมดอายุจริงใน DB
  cachedAt: number;        // timestamp ที่ cache entry นี้สร้าง
}

const sessionCache = new Map<string, CachedSession>();

function cacheGet(token: string): SessionUser | null {
  const entry = sessionCache.get(token);
  if (!entry) return null;

  const now = Date.now();

  // หมดอายุ cache → ลบทิ้ง, ให้ caller ไป query DB ใหม่
  if (now - entry.cachedAt > SESSION_CACHE_TTL_MS) {
    sessionCache.delete(token);
    return null;
  }

  // Session DB หมดอายุไปแล้ว → ลบ cache, ให้ DB query เป็นคนจัดการ flag
  if (now > entry.expiresAt) {
    sessionCache.delete(token);
    return null;
  }

  return entry.user;
}

function cacheSet(token: string, user: SessionUser, expiresAt: Date): void {
  // ถ้าเต็ม → ลบ entry ที่เก่าที่สุด (FIFO)
  if (sessionCache.size >= SESSION_CACHE_MAX) {
    const oldestKey = sessionCache.keys().next().value;
    if (oldestKey) sessionCache.delete(oldestKey);
  }

  sessionCache.set(token, {
    user,
    expiresAt: expiresAt.getTime(),
    cachedAt: Date.now(),
  });
}

/**
 * ลบ entry ออกจาก cache (ใช้ตอน logout / role/active เปลี่ยน)
 */
export function invalidateSessionCache(token: string): void {
  sessionCache.delete(token);
}

/**
 * ล้าง cache ทั้งหมด (ใช้ตอน global key rotation, security incident)
 */
export function clearSessionCache(): void {
  sessionCache.clear();
}

/**
 * ฟังก์ชันสำหรับตรวจสอบการเข้าสู่ระบบจาก request
 * @param request - NextRequest object
 * @returns {Promise<AuthResult>} ผลลัพธ์การตรวจสอบ
 * 
 * ตัวอย่างการใช้งาน:
 * const authResult = await requireAuth(request);
 * if (!authResult.success) {
 *   return NextResponse.json({ error: authResult.error }, { status: authResult.status });
 * }
 * const user = authResult.user;
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  try {
    // ดึง token จาก cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return {
        success: false,
        error: 'NO_SESSION',
        message: 'กรุณาเข้าสู่ระบบ',
        status: 401,
      };
    }

    // ลอง cache ก่อน — เลี่ยง DB hit บน burst traffic
    const cached = cacheGet(token);
    if (cached) {
      return { success: true, user: cached };
    }

    // ค้นหา session จากฐานข้อมูล
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    
    // ตรวจสอบว่า session มีอยู่และยังใช้งานได้
    if (!session || !session.isValid) {
      cookieStore.delete('session_token');
      invalidateSessionCache(token);
      return {
        success: false,
        error: 'INVALID_SESSION',
        message: 'Session ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่',
        status: 401,
      };
    }

    // ตรวจสอบว่า session หมดอายุหรือไม่
    if (new Date() > session.expiresAt) {
      await prisma.session.update({
        where: { id: session.id },
        data: { isValid: false },
      });

      cookieStore.delete('session_token');
      invalidateSessionCache(token);

      return {
        success: false,
        error: 'SESSION_EXPIRED',
        message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่',
        status: 401,
      };
    }
    
    // ตรวจสอบว่าผู้ใช้ยัง active อยู่หรือไม่
    if (!session.user.isActive) {
      return {
        success: false,
        error: 'ACCOUNT_DISABLED',
        message: 'บัญชีของคุณถูกปิดใช้งาน',
        status: 403,
      };
    }
    
    // ส่งข้อมูลผู้ใช้กลับไป (ไม่รวมรหัสผ่าน)
    const { password, ...userWithoutPassword } = session.user;
    const user = userWithoutPassword as SessionUser;

    // เก็บใน cache เพื่อ request ถัดไป
    cacheSet(token, user, session.expiresAt);

    return {
      success: true,
      user,
    };

  } catch (error) {
    console.error('Auth check error:', error);
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'เกิดข้อผิดพลาดภายในระบบ',
      status: 500,
    };
  }
}

/**
 * ฟังก์ชันสำหรับตรวจสอบสิทธิ์ของผู้ใช้
 * @param userRole - บทบาทของผู้ใช้ปัจจุบัน
 * @param allowedRoles - บทบาทที่อนุญาต
 * @returns {boolean} true หากมีสิทธิ์
 * 
 * ตัวอย่างการใช้งาน:
 * const hasPermission = checkRole(user.role, ['ADMIN', 'SUPER_ADMIN']);
 */
export function checkRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * ฟังก์ชันสำหรับตรวจสอบว่าผู้ใช้เป็น admin หรือไม่
 * @param userRole - บทบาทของผู้ใช้
 * @returns {boolean} true หากเป็น admin
 */
export function isAdmin(userRole: UserRole): boolean {
  return ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
}

/**
 * ฟังก์ชันสำหรับตรวจสอบว่าผู้ใช้เป็น manager ขึ้นไปหรือไม่
 * @param userRole - บทบาทของผู้ใช้
 * @returns {boolean} true หากเป็น manager ขึ้นไป
 */
export function isManagerOrAbove(userRole: UserRole): boolean {
  return ['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole);
}

/**
 * ฟังก์ชันสำหรับดึงข้อมูลผู้ใช้ปัจจุบัน
 * @returns {Promise<SessionUser | null>} ข้อมูลผู้ใช้หรือ null หากไม่มี session
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    
    if (!token) {
      return null;
    }
    
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    
    if (!session || !session.isValid || new Date() > session.expiresAt) {
      return null;
    }
    
    if (!session.user.isActive) {
      return null;
    }
    
    const { password, ...userWithoutPassword } = session.user;
    return userWithoutPassword as SessionUser;
    
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * ฟังก์ชันสำหรับตรวจสอบ session โดยไม่ต้องใช้ NextRequest
 * ใช้สำหรับ Server Components
 * @returns {Promise<AuthResult>} ผลลัพธ์การตรวจสอบ
 */
export async function validateSession(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    
    if (!token) {
      return {
        success: false,
        error: 'NO_SESSION',
        message: 'กรุณาเข้าสู่ระบบ',
        status: 401,
      };
    }

    // ลอง cache ก่อน
    const cached = cacheGet(token);
    if (cached) {
      return { success: true, user: cached };
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || !session.isValid) {
      cookieStore.delete('session_token');
      invalidateSessionCache(token);
      return {
        success: false,
        error: 'INVALID_SESSION',
        message: 'Session ไม่ถูกต้อง',
        status: 401,
      };
    }

    if (new Date() > session.expiresAt) {
      await prisma.session.update({
        where: { id: session.id },
        data: { isValid: false },
      });

      cookieStore.delete('session_token');
      invalidateSessionCache(token);

      return {
        success: false,
        error: 'SESSION_EXPIRED',
        message: 'Session หมดอายุ',
        status: 401,
      };
    }

    if (!session.user.isActive) {
      return {
        success: false,
        error: 'ACCOUNT_DISABLED',
        message: 'บัญชีถูกปิดใช้งาน',
        status: 403,
      };
    }

    const { password, ...userWithoutPassword } = session.user;
    const user = userWithoutPassword as SessionUser;
    cacheSet(token, user, session.expiresAt);

    return {
      success: true,
      user,
    };

  } catch (error) {
    console.error('Validate session error:', error);
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'เกิดข้อผิดพลาดภายในระบบ',
      status: 500,
    };
  }
}
