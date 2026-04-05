/**
 * ==================================================
 * API Route: /api/leaves/[id]
 * ==================================================
 * API สำหรับจัดการรายการลาเดี่ยว (อัปเดตสถานะ, ลบ)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLeaveSchema, sanitizeInput } from '@/lib/security';
import { requireAuth, isManagerOrAbove } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * PUT /api/leaves/[id]
 * แก้ไขรายละเอียดการลา
 *
 * Request Body:
 * {
 *   type?: LeaveType;
 *   startDate?: string;
 *   endDate?: string;
 *   reason?: string;
 *   isHalfDay?: boolean;
 *   hours?: number;
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const currentUser = authResult.user!;
    const { id } = await params;
    const leaveId = parseInt(id);

    if (isNaN(leaveId)) {
      return NextResponse.json(
        { success: false, error: 'INVALID_ID', message: 'รหัสการลาไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const existingLeave = await prisma.leave.findUnique({
      where: { id: leaveId },
    });

    if (!existingLeave) {
      return NextResponse.json(
        { success: false, error: 'LEAVE_NOT_FOUND', message: 'ไม่พบรายการลา' },
        { status: 404 }
      );
    }

    // ตรวจสอบสิทธิ์ (เจ้าของรายการหรือ MANAGER ขึ้นไป)
    if (existingLeave.userId !== currentUser.id && !isManagerOrAbove(currentUser.role)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์แก้ไขรายการลานี้' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate ข้อมูล
    const validationResult = createLeaveSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'ข้อมูลไม่ถูกต้อง', details: errors },
        { status: 400 }
      );
    }

    const { type, startDate, endDate, reason, isHalfDay, hours, contactAddress } = validationResult.data;

    // คำนวณจำนวนวันลา
    let totalDays = 0;
    if (hours && hours > 0) {
      totalDays = hours <= 3 ? 0.5 : 1;
    } else if (isHalfDay) {
      totalDays = 0.5;
    } else {
      const start = new Date(startDate);
      const end = new Date(endDate);

      let holidays: Date[] = [];
      try {
        const holidayRecords = await prisma.holiday.findMany({
          where: { isActive: true, date: { gte: start, lte: end } },
          select: { date: true },
        });
        holidays = holidayRecords.map((h: { date: Date }) => h.date);
      } catch {}

      const current = new Date(start);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          const isHoliday = holidays.some(h =>
            h.getFullYear() === current.getFullYear() &&
            h.getMonth() === current.getMonth() &&
            h.getDate() === current.getDate()
          );
          if (!isHoliday) totalDays++;
        }
        current.setDate(current.getDate() + 1);
      }
    }

    const leave = await prisma.leave.update({
      where: { id: leaveId },
      data: {
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason: sanitizeInput(reason),
        isHalfDay: isHalfDay || false,
        hours: hours || null,
        totalDays,
        contactAddress: contactAddress ? sanitizeInput(contactAddress) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            prefix: true,
            name: true,
            avatar: true,
            department: true,
            division: true,
            position: true,
            phone: true,
            address: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: leave,
      message: 'แก้ไขรายการลาสำเร็จ',
    });

  } catch (error) {
    logger.error('Update leave details error', { error });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/leaves/[id]
 * อัปเดตสถานะการลา (อนุมัติ/ไม่อนุมัติ)
 * 
 * Request Body:
 * {
 *   status: 'APPROVED' | 'REJECTED';
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: Leave,
 *   message: 'อัปเดตสถานะการลาสำเร็จ'
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // ตรวจสอบสิทธิ์ (เฉพาะ MANAGER ขึ้นไปเท่านั้นที่อนุมัติได้)
    if (!isManagerOrAbove(currentUser.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: 'คุณไม่มีสิทธิ์อนุมัติการลา',
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const leaveId = parseInt(id);

    if (isNaN(leaveId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_ID',
          message: 'รหัสการลาไม่ถูกต้อง',
        },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าการลามีอยู่หรือไม่
    const existingLeave = await prisma.leave.findUnique({
      where: { id: leaveId },
    });

    if (!existingLeave) {
      return NextResponse.json(
        {
          success: false,
          error: 'LEAVE_NOT_FOUND',
          message: 'ไม่พบรายการลา',
        },
        { status: 404 }
      );
    }

    // ตรวจสอบว่าการลาอยู่ในสถานะรอพิจารณาหรือไม่
    if (existingLeave.status !== 'PENDING') {
      return NextResponse.json(
        {
          success: false,
          error: 'ALREADY_PROCESSED',
          message: 'รายการลานี้ได้รับการพิจารณาแล้ว',
        },
        { status: 400 }
      );
    }

    // อ่านข้อมูลจาก request body
    const body = await request.json();

    // ตรวจสอบสถานะ
    const validStatuses = ['APPROVED', 'REJECTED'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_STATUS',
          message: 'สถานะไม่ถูกต้อง',
        },
        { status: 400 }
      );
    }

    // อัปเดตสถานะการลา
    const leave = await prisma.leave.update({
      where: { id: leaveId },
      data: {
        status: body.status,
        approvedBy: currentUser.id,
        approvedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            prefix: true,
            name: true,
            avatar: true,
            department: true,
            division: true,
            position: true,
            phone: true,
            address: true,
          },
        },
      },
    });

    const message = body.status === 'APPROVED' 
      ? 'อนุมัติการลาสำเร็จ' 
      : 'ปฏิเสธการลาสำเร็จ';

    return NextResponse.json({
      success: true,
      data: leave,
      message,
    });

  } catch (error) {
    logger.error('Update leave error', { error });
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
 * DELETE /api/leaves/[id]
 * ลบรายการลา
 * 
 * Response:
 * {
 *   success: true,
 *   message: 'ลบรายการลาสำเร็จ'
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;
    const leaveId = parseInt(id);

    if (isNaN(leaveId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_ID',
          message: 'รหัสการลาไม่ถูกต้อง',
        },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าการลามีอยู่หรือไม่
    const existingLeave = await prisma.leave.findUnique({
      where: { id: leaveId },
    });

    if (!existingLeave) {
      return NextResponse.json(
        {
          success: false,
          error: 'LEAVE_NOT_FOUND',
          message: 'ไม่พบรายการลา',
        },
        { status: 404 }
      );
    }

    // ตรวจสอบสิทธิ์ (เจ้าของรายการหรือ MANAGER ขึ้นไปเท่านั้น)
    if (existingLeave.userId !== currentUser.id && !isManagerOrAbove(currentUser.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: 'คุณไม่มีสิทธิ์ลบรายการลานี้',
        },
        { status: 403 }
      );
    }

    // ลบรายการลา
    await prisma.leave.delete({
      where: { id: leaveId },
    });

    return NextResponse.json({
      success: true,
      message: 'ลบรายการลาสำเร็จ',
    });

  } catch (error) {
    logger.error('Delete leave error', { error });
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
