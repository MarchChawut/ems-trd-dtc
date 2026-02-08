/**
 * ==================================================
 * API Route: /api/tasks
 * ==================================================
 * API สำหรับจัดการงาน (CRUD operations)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createTaskSchema, sanitizeInput } from '@/lib/security';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/tasks
 * ดึงรายการงานทั้งหมด
 * 
 * Query Parameters:
 * - columnId: กรองตามคอลัมน์
 * - priority: กรองตามความสำคัญ (LOW, MEDIUM, HIGH, URGENT)
 * - assigneeId: กรองตามผู้รับผิดชอบ
 * 
 * Response:
 * {
 *   success: true,
 *   data: Task[]
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

    // ดึง query parameters
    const { searchParams } = new URL(request.url);
    const columnId = searchParams.get('columnId');
    const priority = searchParams.get('priority');
    const assigneeId = searchParams.get('assigneeId');

    // สร้าง where clause
    const where: any = {};

    if (columnId) {
      where.columnId = parseInt(columnId);
    }

    if (priority) {
      where.priority = priority;
    }

    if (assigneeId) {
      where.assigneeId = parseInt(assigneeId);
    }

    // ดึงข้อมูลงาน
    const tasks = await prisma.task.findMany({
      where,
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
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: tasks,
    });

  } catch (error) {
    logger.error('Get tasks error', { error });
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
 * POST /api/tasks
 * สร้างงานใหม่
 * 
 * Request Body:
 * {
 *   title: string;
 *   description?: string;
 *   priority: Priority;
 *   columnId?: number;
 *   assigneeId?: number;
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: Task,
 *   message: 'สร้างงานสำเร็จ'
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

    // อ่านข้อมูลจาก request body
    const body = await request.json();

    // ตรวจสอบข้อมูลด้วย Zod Schema
    const validationResult = createTaskSchema.safeParse(body);

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

    const { title, description, priority, columnId, assigneeId } = validationResult.data;

    // ตรวจสอบว่าคอลัมน์มีอยู่หรือไม่ (ถ้าระบุ)
    if (columnId) {
      const column = await prisma.kanbanColumn.findUnique({
        where: { id: columnId },
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
    }

    // ตรวจสอบว่าผู้รับผิดชอบมีอยู่จริงหรือไม่ (ถ้าระบุ)
    if (assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
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
    }

    // สร้างงานใหม่
    const task = await prisma.task.create({
      data: {
        title: sanitizeInput(title),
        description: description ? sanitizeInput(description) : null,
        priority,
        columnId: columnId || 1, // คอลัมน์แรกเป็นค่าเริ่มต้น
        assigneeId: assigneeId || null,
      },
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

    return NextResponse.json(
      {
        success: true,
        data: task,
        message: 'สร้างงานสำเร็จ',
      },
      { status: 201 }
    );

  } catch (error) {
    logger.error('Create task error', { error });
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
