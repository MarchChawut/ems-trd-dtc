/**
 * ==================================================
 * API Route: /api/leaves
 * ==================================================
 * API สำหรับจัดการรายการลา (CRUD operations)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLeaveSchema, sanitizeInput } from '@/lib/security';
import { requireAuth, isManagerOrAbove } from '@/lib/auth';

/**
 * GET /api/leaves
 * ดึงรายการลาทั้งหมด
 * 
 * Query Parameters:
 * - status: กรองตามสถานะ (PENDING, APPROVED, REJECTED)
 * - type: กรองตามประเภท (SICK, PERSONAL, VACATION, OTHER)
 * - userId: กรองตามผู้ใช้
 * 
 * Response:
 * {
 *   success: true,
 *   data: Leave[]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // ตรวจสอบการเข้าสู่ระบบ
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const currentUser = authResult.user!;

    // ดึง query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const userId = searchParams.get('userId');

    // สร้าง where clause
    const where: any = {};

    // ถ้าไม่ใช่ manager ขึ้นไป ให้เห็นเฉพาะรายการตัวเอง
    if (!isManagerOrAbove(currentUser.role)) {
      where.userId = currentUser.id;
    } else if (userId) {
      where.userId = parseInt(userId);
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    // ดึงข้อมูลการลา
    const leaves = await prisma.leave.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            department: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: leaves,
    });

  } catch (error) {
    console.error('Get leaves error:', error);
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

/**
 * POST /api/leaves
 * สร้างรายการลาใหม่
 * 
 * Request Body:
 * {
 *   userId?: number; // สำหรับ MANAGER ขึ้นไปที่สร้างให้คนอื่น
 *   type: LeaveType;
 *   startDate: string; // YYYY-MM-DD
 *   endDate: string;   // YYYY-MM-DD
 *   reason: string;
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: Leave,
 *   message: 'บันทึกการลาสำเร็จ'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ตรวจสอบการเข้าสู่ระบบ
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const currentUser = authResult.user!;

    // อ่านข้อมูลจาก request body
    const body = await request.json();

    // ตรวจสอบข้อมูลด้วย Zod Schema
    const validationResult = createLeaveSchema.safeParse(body);

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

    const { type, startDate, endDate, reason } = validationResult.data;

    // กำหนด userId สำหรับการลา
    let targetUserId = currentUser.id;
    
    // ถ้าระบุ userId และเป็น MANAGER ขึ้นไป ให้ใช้ userId นั้น
    if (body.userId && isManagerOrAbove(currentUser.role)) {
      // ตรวจสอบว่าผู้ใช้มีอยู่จริง
      const targetUser = await prisma.user.findUnique({
        where: { id: body.userId },
      });
      
      if (!targetUser) {
        return NextResponse.json(
          {
            success: false,
            error: 'USER_NOT_FOUND',
            message: 'ไม่พบผู้ใช้ที่ระบุ',
          },
          { status: 404 }
        );
      }
      
      targetUserId = body.userId;
    }

    // สร้างรายการลาใหม่
    const leave = await prisma.leave.create({
      data: {
        userId: targetUserId,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason: sanitizeInput(reason),
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            department: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: leave,
        message: 'บันทึกการลาสำเร็จ',
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Create leave error:', error);
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
