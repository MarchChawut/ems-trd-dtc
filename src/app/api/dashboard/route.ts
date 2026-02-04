/**
 * ==================================================
 * API Route: GET /api/dashboard
 * ==================================================
 * API สำหรับดึงข้อมูลสถิติแดชบอร์ด
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/dashboard
 * ดึงข้อมูลสถิติสำหรับแดชบอร์ด
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     totalUsers: number;
 *     activeUsers: number;
 *     pendingLeaves: number;
 *     totalLeaves: number;
 *     inProgressTasks: number;
 *     doneTasks: number;
 *     totalTasks: number;
 *   }
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

    // ดึงข้อมูลสถิติพร้อมกัน
    const [
      totalUsers,
      activeUsers,
      pendingLeaves,
      totalLeaves,
      inProgressTasks,
      doneTasks,
      totalTasks,
    ] = await Promise.all([
      // จำนวนผู้ใช้ทั้งหมด
      prisma.user.count(),
      
      // จำนวนผู้ใช้ที่ active
      prisma.user.count({ where: { isActive: true } }),
      
      // จำนวนการลาที่รออนุมัติ
      prisma.leave.count({ where: { status: 'PENDING' } }),
      
      // จำนวนการลาทั้งหมด
      prisma.leave.count(),
      
      // จำนวนงานที่กำลังทำ
      prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
      
      // จำนวนงานที่เสร็จสิ้น
      prisma.task.count({ where: { status: 'DONE' } }),
      
      // จำนวนงานทั้งหมด
      prisma.task.count(),
    ]);

    // ดึงข้อมูลการลาล่าสุดที่รออนุมัติ (5 รายการ)
    const recentPendingLeaves = await prisma.leave.findMany({
      where: { status: 'PENDING' },
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
      take: 5,
    });

    // ดึงข้อมูลงานล่าสุด (5 รายการ)
    const recentTasks = await prisma.task.findMany({
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeUsers,
          pendingLeaves,
          totalLeaves,
          inProgressTasks,
          doneTasks,
          totalTasks,
        },
        recentPendingLeaves,
        recentTasks,
      },
    });

  } catch (error) {
    console.error('Dashboard error:', error);
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
