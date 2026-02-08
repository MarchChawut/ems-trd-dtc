/**
 * ==================================================
 * API Route: GET /api/leaves/export
 * ==================================================
 * API สำหรับ Export ข้อมูลการลาเป็น CSV
 * รองรับการกรองด้วยชื่อและระยะเวลา
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * แปลงข้อมูลเป็น CSV format
 */
function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';
  
  const headers = [
    'รหัส',
    'ชื่อพนักงาน',
    'แผนก',
    'ประเภทการลา',
    'วันที่เริ่ม',
    'วันที่สิ้นสุด',
    'จำนวนวัน',
    'เหตุผล',
    'สถานะ',
    'ผู้อนุมัติ',
    'วันที่บันทึก',
  ];
  
  const rows = data.map(item => [
    item.id,
    item.user.name,
    item.user.department || '-',
    translateLeaveType(item.type),
    formatDate(item.startDate),
    formatDate(item.endDate),
    calculateDays(item.startDate, item.endDate),
    `"${item.reason.replace(/"/g, '""')}"`, // Escape quotes
    translateStatus(item.status),
    item.approvedBy || '-',
    formatDate(item.createdAt),
  ]);
  
  // Add BOM for Thai language support
  return '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * แปลงประเภทการลาเป็นภาษาไทย
 */
function translateLeaveType(type: string): string {
  const types: Record<string, string> = {
    'SICK': 'ลาป่วย',
    'PERSONAL': 'ลากิจ',
    'VACATION': 'ลาพักร้อน',
    'OTHER': 'อื่นๆ',
  };
  return types[type] || type;
}

/**
 * แปลงสถานะเป็นภาษาไทย
 */
function translateStatus(status: string): string {
  const statuses: Record<string, string> = {
    'PENDING': 'รอพิจารณา',
    'APPROVED': 'อนุมัติ',
    'REJECTED': 'ไม่อนุมัติ',
  };
  return statuses[status] || status;
}

/**
 * จัดรูปแบบวันที่
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * คำนวณจำนวนวัน
 */
function calculateDays(startDate: Date | string, endDate: Date | string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * GET /api/leaves/export
 * Export ข้อมูลการลาเป็น CSV
 * 
 * Query Parameters:
 * - name: ค้นหาด้วยชื่อพนักงาน
 * - startDate: วันเริ่มต้น (YYYY-MM-DD)
 * - endDate: วันสิ้นสุด (YYYY-MM-DD)
 * 
 * Response: CSV file download
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // สร้าง where clause
    const where: any = {};

    // กรองด้วยชื่อ
    if (name) {
      where.user = {
        name: {
          contains: name,
        },
      };
    }

    // กรองด้วยระยะเวลา
    if (startDate && endDate) {
      where.AND = [
        { startDate: { gte: new Date(startDate) } },
        { endDate: { lte: new Date(endDate) } },
      ];
    } else if (startDate) {
      where.startDate = { gte: new Date(startDate) };
    } else if (endDate) {
      where.endDate = { lte: new Date(endDate) };
    }

    // ดึงข้อมูลการลา
    const leaves = await prisma.leave.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            department: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    // แปลงเป็น CSV
    const csv = convertToCSV(leaves);

    // สร้างชื่อไฟล์
    const fileName = `leaves_export_${new Date().toISOString().split('T')[0]}.csv`;

    // ส่งไฟล์ CSV
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (error) {
    logger.error('Export leaves error', { error });
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
