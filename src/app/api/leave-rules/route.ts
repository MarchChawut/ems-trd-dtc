/**
 * ==================================================
 * API Route: /api/leave-rules
 * ==================================================
 * API สำหรับจัดการกฎเกณฑ์การลา (CRUD operations)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, isManagerOrAbove } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  leaveRuleSchema,
  updateLeaveRuleSchema,
  idSchema,
  sanitizeInput,
} from '@/lib/security';

/**
 * GET /api/leave-rules
 * ดึงกฎเกณฑ์การลาทั้งหมด
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const rules = await prisma.leaveRule.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // ถ้าไม่มีกฎ ให้สร้างกฎเริ่มต้น
    if (rules.length === 0) {
      const defaultRule = await prisma.leaveRule.create({
        data: {
          name: 'กฎการลามาตรฐาน',
          startTime: '08:30',
          endTime: '16:30',
          fullDayHours: 8,
          halfDayHours: 4,
          maxConsecutiveDays: 30,
          isActive: true,
        },
      });
      return NextResponse.json({
        success: true,
        data: [defaultRule],
      });
    }

    return NextResponse.json({
      success: true,
      data: rules,
    });

  } catch (error) {
    logger.error('Get leave rules error', { error });
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
 * POST /api/leave-rules
 * สร้างกฎเกณฑ์การลาใหม่ (เฉพาะ Admin)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const currentUser = authResult.user!;
    
    // เฉพาะ Admin ขึ้นไปเท่านั้น
    if (!isManagerOrAbove(currentUser.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: 'คุณไม่มีสิทธิ์จัดการกฎการลา',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = leaveRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'ข้อมูลกฎการลาไม่ถูกต้อง',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const rule = await prisma.leaveRule.create({
      data: {
        name: sanitizeInput(parsed.data.name),
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        fullDayHours: parsed.data.fullDayHours ?? 8,
        halfDayHours: parsed.data.halfDayHours ?? 4,
        maxConsecutiveDays: parsed.data.maxConsecutiveDays ?? 30,
        isActive: parsed.data.isActive ?? true,
      },
    });

    return NextResponse.json({
      success: true,
      data: rule,
      message: 'สร้างกฎการลาสำเร็จ',
    }, { status: 201 });

  } catch (error) {
    logger.error('Create leave rule error', { error });
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
 * PATCH /api/leave-rules
 * อัปเดตกฎเกณฑ์การลา (เฉพาะ Admin)
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const currentUser = authResult.user!;
    
    if (!isManagerOrAbove(currentUser.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: 'คุณไม่มีสิทธิ์จัดการกฎการลา',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateLeaveRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'ข้อมูลกฎการลาไม่ถูกต้อง',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { id, name, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (name !== undefined) updateData.name = sanitizeInput(name);

    const rule = await prisma.leaveRule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: rule,
      message: 'อัปเดตกฎการลาสำเร็จ',
    });

  } catch (error) {
    logger.error('Update leave rule error', { error });
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
