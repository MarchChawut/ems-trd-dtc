/**
 * ==================================================
 * API Route: GET /api/leaves/export
 * ==================================================
 * API สำหรับ Export ข้อมูลการลาเป็น CSV
 * รองรับการกรองด้วยชื่อ ระยะเวลา และเลือกคอลัมน์
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * คอลัมน์ทั้งหมดที่รองรับ
 */
const ALL_COLUMNS = ['id', 'name', 'department', 'type', 'startDate', 'endDate', 'days', 'reason', 'status', 'approvedBy', 'createdAt'] as const;
type ColumnKey = typeof ALL_COLUMNS[number];

const COLUMN_HEADERS: Record<ColumnKey, string> = {
  id: 'รหัส',
  name: 'ชื่อพนักงาน',
  department: 'แผนก',
  type: 'ประเภทการลา',
  startDate: 'วันที่เริ่ม',
  endDate: 'วันที่สิ้นสุด',
  days: 'จำนวนวัน',
  reason: 'เหตุผล',
  status: 'สถานะ',
  approvedBy: 'ผู้อนุมัติ',
  createdAt: 'วันที่บันทึก',
};

/**
 * แปลงข้อมูลเป็น CSV format พร้อมเลือกคอลัมน์
 */
function convertToCSV(data: any[], columns: ColumnKey[]): string {
  if (data.length === 0) return '';

  const headers = columns.map(col => COLUMN_HEADERS[col]);

  const rows = data.map(item => {
    return columns.map(col => {
      switch (col) {
        case 'id': return item.id;
        case 'name': return `${item.user.prefix || ''}${item.user.name}`;
        case 'department': return item.user.department || '-';
        case 'type': return translateLeaveType(item.type);
        case 'startDate': return formatDate(item.startDate);
        case 'endDate': return formatDate(item.endDate);
        case 'days': return calculateDays(item.startDate, item.endDate, item.isHalfDay, item.hours);
        case 'reason': return `"${item.reason.replace(/"/g, '""')}"`;
        case 'status': return translateStatus(item.status);
        case 'approvedBy': return item.approvedBy || '-';
        case 'createdAt': return formatDate(item.createdAt);
        default: return '';
      }
    });
  });

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
    'MATERNITY': 'ลาคลอดบุตร',
    'ORDINATION': 'ลาบวช',
    'EARLY_LEAVE': 'ออกก่อนเวลา',
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
 * คำนวณจำนวนวัน (รองรับครึ่งวันและรายชั่วโมง)
 */
function calculateDays(startDate: Date | string, endDate: Date | string, isHalfDay?: boolean, hours?: number | null): string {
  if (hours && hours > 0) {
    if (hours <= 3) return '0.5';
    if (hours >= 8) return '1';
    return (hours / 8).toFixed(1);
  }
  if (isHalfDay) return '0.5';
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return days.toString();
}

/**
 * GET /api/leaves/export
 * Export ข้อมูลการลาเป็น CSV
 *
 * Query Parameters:
 * - name: ค้นหาด้วยชื่อพนักงาน
 * - startDate: วันเริ่มต้น (YYYY-MM-DD)
 * - endDate: วันสิ้นสุด (YYYY-MM-DD)
 * - columns: คอลัมน์ที่ต้องการ (comma-separated)
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
    const columnsParam = searchParams.get('columns');

    // กำหนดคอลัมน์ที่จะ export
    let selectedColumns: ColumnKey[];
    if (columnsParam) {
      selectedColumns = columnsParam.split(',').filter(
        (col): col is ColumnKey => ALL_COLUMNS.includes(col as ColumnKey)
      );
      if (selectedColumns.length === 0) {
        selectedColumns = [...ALL_COLUMNS];
      }
    } else {
      selectedColumns = [...ALL_COLUMNS];
    }

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
            prefix: true,
            name: true,
            department: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    // แปลงเป็น CSV
    const csv = convertToCSV(leaves, selectedColumns);

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
