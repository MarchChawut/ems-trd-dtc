/**
 * ==================================================
 * API Route: /api/leaves/statistics
 * ==================================================
 * API สำหรับดึงสถิติการลาของผู้ใช้ตามประเภทการลา
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const currentUser = authResult.user!;
    const { searchParams } = new URL(request.url);
    
    // รับ userId จาก query parameter (optional, สำหรับ Admin/Manager ดูสถิติของคนอื่น)
    const userIdParam = searchParams.get('userId');
    const userId = userIdParam ? parseInt(userIdParam) : currentUser.id;
    
    // รับปีงบประมาณ (ค่าเริ่มต้น = ปีปัจจุบัน)
    const yearParam = searchParams.get('year');
    const fiscalYear = yearParam ? parseInt(yearParam) : new Date().getFullYear();
    
    // กำหนดช่วงวันที่ของปีงบประมาณ (1 ต.ค. - 30 ก.ย.)
    const fiscalYearStart = new Date(fiscalYear, 9, 1); // 1 ต.ค.
    const fiscalYearEnd = new Date(fiscalYear + 1, 8, 30, 23, 59, 59); // 30 ก.ย.

    // ดึงข้อมูลการลาทั้งหมดในปีงบประมาณของผู้ใช้
    const leaves = await prisma.leave.findMany({
      where: {
        userId,
        startDate: {
          gte: fiscalYearStart,
          lte: fiscalYearEnd,
        },
        status: {
          in: ['PENDING', 'APPROVED'], // นับทั้งที่รออนุมัติและอนุมัติแล้ว
        },
      },
    });

    // คำนวณสถิติตามประเภทการลา
    const stats = {
      SICK: { count: 0, days: 0 },
      PERSONAL: { count: 0, days: 0 },
      VACATION: { count: 0, days: 0 },
      MATERNITY: { count: 0, days: 0 },
      ORDINATION: { count: 0, days: 0 },
      OTHER: { count: 0, days: 0 },
    };

    leaves.forEach((leave) => {
      const type = leave.type as keyof typeof stats;
      if (stats[type]) {
        stats[type].count += 1;
        stats[type].days += leave.totalDays || 0;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        fiscalYear,
        userId,
        statistics: stats,
        totalLeaves: leaves.length,
      },
    });

  } catch (error) {
    logger.error('Get leave statistics error', { error });
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
