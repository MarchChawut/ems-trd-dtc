/**
 * ==================================================
 * API Route: GET /api/leaves/search
 * ==================================================
 * API สำหรับค้นหาการลาด้วยชื่อหรือวันที่
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/leaves/search
 * ค้นหาการลาด้วยชื่อหรือวันที่
 * 
 * Query Parameters:
 * - name: ค้นหาด้วยชื่อพนักงาน
 * - date: ค้นหาว่าวันนี้มีใครลาบ้าง (YYYY-MM-DD)
 * - startDate: วันเริ่มต้นช่วงค้นหา
 * - endDate: วันสิ้นสุดช่วงค้นหา
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

    // ดึง query parameters
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // สร้าง where clause
    const where: any = {};

    // ค้นหาด้วยชื่อ
    if (name) {
      where.user = {
        name: {
          contains: name,
        },
      };
    }

    // ค้นหาด้วยวันที่เฉพาะวัน
    if (date) {
      const searchDate = new Date(date);
      where.AND = [
        { startDate: { lte: searchDate } },
        { endDate: { gte: searchDate } },
      ];
    }

    // ค้นหาด้วยช่วงวันที่
    if (startDate && endDate) {
      where.AND = [
        { startDate: { lte: new Date(endDate) } },
        { endDate: { gte: new Date(startDate) } },
      ];
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
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: leaves,
      count: leaves.length,
    });

  } catch (error) {
    logger.error('Search leaves error', { error });
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
