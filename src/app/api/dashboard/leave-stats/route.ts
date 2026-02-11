/**
 * ==================================================
 * API Route: GET /api/dashboard/leave-stats
 * ==================================================
 * API สำหรับดึงข้อมูลสถิติการลาแยกตามผู้ใช้/ประเภท/เดือน ในปีงบประมาณ
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * คำนวณช่วงปีงบประมาณ (1 ต.ค. - 30 ก.ย.)
 */
function getFiscalYearRange(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const fiscalStartYear = month >= 9 ? year : year - 1;
  return {
    start: new Date(fiscalStartYear, 9, 1),
    end: new Date(fiscalStartYear + 1, 8, 30, 23, 59, 59),
  };
}

/**
 * คำนวณจำนวนวันทำการ (ไม่รวมเสาร์-อาทิตย์ และวันหยุดหน่วยงาน)
 */
function calculateBusinessDays(
  startDate: Date,
  endDate: Date,
  isHalfDay: boolean,
  hours: number | null,
  holidays: Date[],
): number {
  if (hours && hours > 0) {
    return hours <= 3 ? 0.5 : 1; // ลา ≤ 3 ชม. = ครึ่งวัน, > 3 ชม. = 1 วัน
  }
  if (isHalfDay) return 0.5;

  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const dateStr = current.toISOString().split('T')[0];
      const isOrgHoliday = holidays.some(
        (h) => new Date(h).toISOString().split('T')[0] === dateStr,
      );
      if (!isOrgHoliday) count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status },
      );
    }

    const fiscalRange = getFiscalYearRange(new Date());

    // ดึงการลาทั้งหมดในปีงบประมาณ (APPROVED + PENDING)
    const leaves = await prisma.leave.findMany({
      where: {
        startDate: {
          gte: fiscalRange.start,
          lte: fiscalRange.end,
        },
        status: { in: ['APPROVED', 'PENDING'] },
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
      orderBy: { startDate: 'asc' },
    });

    // ดึงวันหยุดหน่วยงานในปีงบประมาณ
    let holidays: Date[] = [];
    try {
      const orgHolidays = await (prisma as any).holiday.findMany({
        where: {
          date: {
            gte: fiscalRange.start,
            lte: fiscalRange.end,
          },
        },
      });
      holidays = orgHolidays.map((h: any) => h.date);
    } catch {
      // holiday table อาจยังไม่มี
    }

    // Thai month names
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    ];

    // สร้าง fiscal year months (ต.ค. -> ก.ย.)
    const fiscalStartYear = fiscalRange.start.getFullYear();
    const fiscalMonths: { month: number; year: number; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const m = (9 + i) % 12; // 9=ต.ค., 10=พ.ย., ..., 8=ก.ย.
      const y = m >= 9 ? fiscalStartYear : fiscalStartYear + 1;
      const buddhistYear = (y + 543).toString().slice(-2);
      fiscalMonths.push({
        month: m,
        year: y,
        label: `${thaiMonths[m]}${buddhistYear}`,
      });
    }

    // สร้างข้อมูลแยกตามผู้ใช้
    const userMap = new Map<
      number,
      {
        userId: number;
        userName: string;
        avatar: string | null;
        department: string | null;
        leaves: {
          id: number;
          type: string;
          startDate: string;
          endDate: string;
          days: number;
          month: number;
          year: number;
        }[];
      }
    >();

    for (const leave of leaves) {
      if (!userMap.has(leave.userId)) {
        userMap.set(leave.userId, {
          userId: leave.userId,
          userName: leave.user.name,
          avatar: leave.user.avatar,
          department: leave.user.department,
          leaves: [],
        });
      }

      const days = calculateBusinessDays(
        leave.startDate,
        leave.endDate,
        leave.isHalfDay,
        leave.hours,
        holidays,
      );

      const startMonth = new Date(leave.startDate).getMonth();
      const startYear = new Date(leave.startDate).getFullYear();

      userMap.get(leave.userId)!.leaves.push({
        id: leave.id,
        type: leave.type,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        days,
        month: startMonth,
        year: startYear,
      });
    }

    // สร้าง chart data: แต่ละเดือนมีข้อมูลแยกตามผู้ใช้
    const chartData = fiscalMonths.map((fm) => {
      const monthData: Record<string, any> = {
        month: fm.label,
        monthIndex: fm.month,
        year: fm.year,
      };

      Array.from(userMap.values()).forEach((userData) => {
        const userMonthLeaves = userData.leaves.filter(
          (l: { month: number; year: number }) => l.month === fm.month && l.year === fm.year,
        );
        if (userMonthLeaves.length > 0) {
          const totalDays = userMonthLeaves.reduce((sum: number, l: { days: number }) => sum + l.days, 0);
          monthData[`user_${userData.userId}`] = Math.round(totalDays * 100) / 100;
        }
      });

      return monthData;
    });

    // สร้าง per-user per-type summary
    const userSummaries = Array.from(userMap.values()).map((u) => {
      const byType: Record<string, { count: number; days: number }> = {};
      for (const l of u.leaves) {
        if (!byType[l.type]) byType[l.type] = { count: 0, days: 0 };
        byType[l.type].count++;
        byType[l.type].days += l.days;
      }
      return {
        userId: u.userId,
        userName: u.userName,
        avatar: u.avatar,
        department: u.department,
        byType,
        totalCount: u.leaves.length,
        totalDays: Math.round(u.leaves.reduce((s, l) => s + l.days, 0) * 100) / 100,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        fiscalYear: `${(fiscalStartYear + 543).toString()} - ${((fiscalStartYear + 1) + 543).toString()}`,
        fiscalRange: {
          start: fiscalRange.start.toISOString(),
          end: fiscalRange.end.toISOString(),
        },
        fiscalMonths: fiscalMonths.map((fm) => fm.label),
        chartData,
        users: Array.from(userMap.values()).map((u) => ({
          userId: u.userId,
          userName: u.userName,
          avatar: u.avatar,
          department: u.department,
        })),
        userSummaries,
        leaves: leaves.map((l) => ({
          id: l.id,
          userId: l.userId,
          userName: l.user.name,
          type: l.type,
          startDate: l.startDate.toISOString(),
          endDate: l.endDate.toISOString(),
          days: calculateBusinessDays(l.startDate, l.endDate, l.isHalfDay, l.hours, holidays),
          isHalfDay: l.isHalfDay,
          hours: l.hours,
          status: l.status,
          month: new Date(l.startDate).getMonth(),
          year: new Date(l.startDate).getFullYear(),
        })),
      },
    });
  } catch (error) {
    logger.error('Leave stats error', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'เกิดข้อผิดพลาดภายในระบบ',
      },
      { status: 500 },
    );
  }
}
