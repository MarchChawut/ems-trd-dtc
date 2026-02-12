/**
 * ==================================================
 * API Route: GET /api/auth/session
 * ==================================================
 * API สำหรับตรวจสอบและดึงข้อมูล session ปัจจุบัน
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/session
 * ตรวจสอบและดึงข้อมูล session ปัจจุบัน
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     user: { id, email, username, name, role, avatar },
 *     expiresAt: Date
 *   }
 * }
 * 
 * หรือ
 * {
 *   success: false,
 *   error: 'NO_SESSION',
 *   message: 'ไม่พบ session'
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // ดึง token จาก cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'NO_SESSION',
          message: 'ไม่พบ session กรุณาเข้าสู่ระบบใหม่',
        },
        { status: 401 }
      );
    }
    
    // ค้นหา session จากฐานข้อมูล
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    
    // ตรวจสอบว่า session มีอยู่และยังใช้งานได้
    if (!session || !session.isValid) {
      // ลบ cookie ที่ไม่ valid
      cookieStore.delete('session_token');
      
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_SESSION',
          message: 'Session ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่',
        },
        { status: 401 }
      );
    }
    
    // ตรวจสอบว่า session หมดอายุหรือไม่
    if (new Date() > session.expiresAt) {
      // ยกเลิก session
      await prisma.session.update({
        where: { id: session.id },
        data: { isValid: false },
      });
      
      // ลบ cookie
      cookieStore.delete('session_token');
      
      return NextResponse.json(
        {
          success: false,
          error: 'SESSION_EXPIRED',
          message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่',
        },
        { status: 401 }
      );
    }
    
    // ตรวจสอบว่าผู้ใช้ยัง active อยู่หรือไม่
    if (!session.user.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'ACCOUNT_DISABLED',
          message: 'บัญชีของคุณถูกปิดใช้งาน',
        },
        { status: 403 }
      );
    }
    
    // ส่งข้อมูลผู้ใช้กลับไป (ไม่รวมรหัสผ่าน)
    const { password, ...userWithoutPassword } = session.user;
    
    return NextResponse.json({
      success: true,
      data: {
        user: userWithoutPassword,
        expiresAt: session.expiresAt,
      },
    });
    
  } catch (error) {
    logger.error('Session check error', { error });
    
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'เกิดข้อผิดพลาดภายในระบบ',
      },
      { status: 500 }
    );
  }
}
