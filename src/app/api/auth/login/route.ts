/**
 * ==================================================
 * API Route: POST /api/auth/login
 * ==================================================
 * API สำหรับเข้าสู่ระบบด้วย username และ password
 * มีการป้องกัน Brute Force Attack และการบันทึก log
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  verifyPassword, 
  loginSchema, 
  generateSecureToken,
  generateAvatarInitials 
} from '@/lib/security';
import { dbRateLimit } from '@/lib/rate-limit-db';
import { logger } from '@/lib/logger';
import { cookies } from 'next/headers';

/**
 * ฟังก์ชันสำหรับดึง IP address จาก request
 * @param request - NextRequest object
 * @returns {string} IP address
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}

/**
 * POST /api/auth/login
 * เข้าสู่ระบบด้วย username และ password
 * 
 * Request Body:
 * {
 *   username: string;
 *   password: string;
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     user: { id, email, username, name, role, avatar },
 *     token: string,
 *     expiresAt: Date
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  // ดึง IP address ของ client (declare outside try for error logging)
  const clientIp = getClientIp(request);
  
  try {
    // ตรวจสอบ Rate Limiting (ป้องกัน Brute Force) แบบ Database
    const isLimited = await dbRateLimit.isRateLimited(clientIp);
    if (isLimited) {
      logger.warn('Blocked login attempt due to rate limit', { ip: clientIp });
      await prisma.loginAttempt.create({
        data: {
          username: 'unknown',
          ipAddress: clientIp,
          success: false,
          reason: 'IP ถูกบล็อกเนื่องจากพยายามเข้าสู่ระบบผิดพลาดหลายครั้ง',
        },
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'TOO_MANY_ATTEMPTS',
          message: 'คุณพยายามเข้าสู่ระบบผิดพลาดหลายครั้ง กรุณาลองใหม่ในอีก 30 นาที',
        },
        { status: 429 }
      );
    }

    // อ่านข้อมูลจาก request body
    const body = await request.json();
    
    // ตรวจสอบข้อมูลด้วย Zod Schema
    const validationResult = loginSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'ข้อมูลไม่ถูกต้อง',
          details: errors,
        },
        { status: 400 }
      );
    }
    
    const { username, password } = validationResult.data;
    
    // ค้นหาผู้ใช้จากฐานข้อมูล
    const user = await prisma.user.findUnique({
      where: { username },
    });
    
    // ตรวจสอบว่าผู้ใช้มีอยู่หรือไม่
    if (!user) {
      // บันทึกการพยายามเข้าสู่ระบบที่ล้มเหลว
      await prisma.loginAttempt.create({
        data: {
          username,
          ipAddress: clientIp,
          success: false,
          reason: 'ไม่พบผู้ใช้',
        },
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
        },
        { status: 401 }
      );
    }
    
    // ตรวจสอบว่าผู้ใช้ถูกปิดใช้งานหรือไม่
    if (!user.isActive) {
      await prisma.loginAttempt.create({
        data: {
          userId: user.id,
          username,
          ipAddress: clientIp,
          success: false,
          reason: 'บัญชีถูกปิดใช้งาน',
        },
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'ACCOUNT_DISABLED',
          message: 'บัญชีของคุณถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
        },
        { status: 403 }
      );
    }
    
    // ตรวจสอบรหัสผ่าน
    const isPasswordValid = await verifyPassword(password, user.password);
    
    if (!isPasswordValid) {
      // บันทึกการพยายามเข้าสู่ระบบที่ล้มเหลว
      await prisma.loginAttempt.create({
        data: {
          userId: user.id,
          username,
          ipAddress: clientIp,
          success: false,
          reason: 'รหัสผ่านไม่ถูกต้อง',
        },
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
        },
        { status: 401 }
      );
    }
    
    // เข้าสู่ระบบสำเร็จ - ล้างข้อมูลการพยายามที่ล้มเหลว
    await dbRateLimit.clearAttempts(clientIp);
    await dbRateLimit.clearAttempts(username);
    
    logger.info('User logged in successfully', { userId: user.id, username, ip: clientIp });
    
    // สร้าง session token
    const token = generateSecureToken(64);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // หมดอายุใน 24 ชั่วโมง
    
    // บันทึก session ลงฐานข้อมูล
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
        ipAddress: clientIp,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });
    
    // บันทึกการเข้าสู่ระบบที่สำเร็จ
    await prisma.loginAttempt.create({
      data: {
        userId: user.id,
        username,
        ipAddress: clientIp,
        success: true,
      },
    });
    
    // สร้าง avatar หากยังไม่มี
    const avatar = user.avatar || generateAvatarInitials(user.name);
    
    // สร้าง cookie สำหรับ session
    const sameSiteEnv = process.env.COOKIE_SAMESITE as "lax" | "strict" | "none" | undefined;
    
    (await cookies()).set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt,
      path: '/',
    });
    
    // ส่งข้อมูลผู้ใช้กลับไป (ไม่รวมรหัสผ่าน)
    const { password: _, ...userWithoutPassword } = user;
    
    return NextResponse.json({
      success: true,
      data: {
        user: {
          ...userWithoutPassword,
          avatar,
        },
        token,
        expiresAt,
      },
      message: 'เข้าสู่ระบบสำเร็จ',
    });
    
  } catch (error) {
    logger.error('Login error', { error, ip: clientIp });
    
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง',
      },
      { status: 500 }
    );
  }
}
