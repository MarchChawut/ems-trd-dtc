/**
 * ==================================================
 * API Route: /api/tasks/[id]
 * ==================================================
 * API สำหรับจัดการงานเดี่ยว (อัปเดต, ลบ)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sanitizeInput } from '@/lib/security';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * PATCH /api/tasks/[id]
 * อัปเดตข้อมูลงาน
 * 
 * Request Body:
 * {
 *   title?: string;
 *   description?: string;
 *   columnId?: number;
 *   priority?: Priority;
 *   assigneeId?: number | null;
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: Task,
 *   message: 'อัปเดตงานสำเร็จ'
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

    const taskId = parseInt(params.id);

    if (isNaN(taskId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_ID',
          message: 'รหัสงานไม่ถูกต้อง',
        },
        { status: 400 }
      );
    }

    // ตรวจสอบว่างานมีอยู่หรือไม่
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      return NextResponse.json(
        {
          success: false,
          error: 'TASK_NOT_FOUND',
          message: 'ไม่พบงาน',
        },
        { status: 404 }
      );
    }

    // อ่านข้อมูลจาก request body
    const body = await request.json();

    // สร้างข้อมูลสำหรับอัปเดต
    const updateData: any = {};

    if (body.title !== undefined) {
      updateData.title = sanitizeInput(body.title);
    }

    if (body.description !== undefined) {
      updateData.description = body.description ? sanitizeInput(body.description) : null;
    }

    if (body.columnId !== undefined) {
      const column = await prisma.kanbanColumn.findUnique({
        where: { id: body.columnId },
      });

      if (!column) {
        return NextResponse.json(
          {
            success: false,
            error: 'COLUMN_NOT_FOUND',
            message: 'ไม่พบคอลัมน์',
          },
          { status: 404 }
        );
      }
      updateData.columnId = body.columnId;
    }

    if (body.priority !== undefined) {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      if (!validPriorities.includes(body.priority)) {
        return NextResponse.json(
          {
            success: false,
            error: 'INVALID_PRIORITY',
            message: 'ระดับความสำคัญไม่ถูกต้อง',
          },
          { status: 400 }
        );
      }
      updateData.priority = body.priority;
    }

    if (body.assigneeId !== undefined) {
      if (body.assigneeId === null) {
        updateData.assigneeId = null;
      } else {
        const assignee = await prisma.user.findUnique({
          where: { id: body.assigneeId },
        });

        if (!assignee) {
          return NextResponse.json(
            {
              success: false,
              error: 'ASSIGNEE_NOT_FOUND',
              message: 'ไม่พบผู้รับผิดชอบ',
            },
            { status: 404 }
          );
        }
        updateData.assigneeId = body.assigneeId;
      }
    }

    // อัปเดตงาน
    const task = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        column: true,
        assignee: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: task,
      message: 'อัปเดตงานสำเร็จ',
    });

  } catch (error) {
    logger.error('Update task error', { error });
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
 * DELETE /api/tasks/[id]
 * ลบงาน
 * 
 * Response:
 * {
 *   success: true,
 *   message: 'ลบงานสำเร็จ'
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

    const taskId = parseInt(params.id);

    if (isNaN(taskId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_ID',
          message: 'รหัสงานไม่ถูกต้อง',
        },
        { status: 400 }
      );
    }

    // ตรวจสอบว่างานมีอยู่หรือไม่
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      return NextResponse.json(
        {
          success: false,
          error: 'TASK_NOT_FOUND',
          message: 'ไม่พบงาน',
        },
        { status: 404 }
      );
    }

    // ลบงาน
    await prisma.task.delete({
      where: { id: taskId },
    });

    return NextResponse.json({
      success: true,
      message: 'ลบงานสำเร็จ',
    });

  } catch (error) {
    logger.error('Delete task error', { error });
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
