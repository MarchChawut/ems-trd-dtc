/**
 * ==================================================
 * API Route: /api/leaves/[id]
 * ==================================================
 * API สำหรับจัดการรายการลาเดี่ยว (อัปเดตสถานะ, ลบ)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, isManagerOrAbove } from '@/lib/auth';
import { logger } from '@/lib/logger';

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
  { params }: { params: { id: string } }
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

    const leaveId = parseInt(params.id);

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
            name: true,
            avatar: true,
            department: true,
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
  { params }: { params: { id: string } }
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
    const leaveId = parseInt(params.id);

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
