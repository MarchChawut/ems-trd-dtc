/**
 * ==================================================
 * API Route: GET /api/supplies/export
 * ==================================================
 * Export รายการพัสดุเป็น CSV (รองรับ Thai)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, isManagerOrAbove } from '@/lib/auth';
import { logger } from '@/lib/logger';

const SUPPLY_TYPE_LABELS: Record<string, string> = {
  STOCK: 'คงคลัง',
  NON_STOCK: 'ไม่คงคลัง',
};

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    if (!isManagerOrAbove(authResult.user!.role)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์ Export ข้อมูล' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const where: any = { isActive: true };
    if (type) where.type = type;

    const supplies = await prisma.supply.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });

    const headers = [
      'รหัส', 'ชื่อพัสดุ', 'ประเภท', 'หมวดหมู่', 'หน่วย',
      'คงเหลือ', 'ขั้นต่ำ', 'ผู้จำหน่าย', 'ราคา/หน่วย',
      'เลขที่เอกสาร', 'หมายเหตุ', 'วันที่บันทึก',
    ];

    const rows = supplies.map(s => [
      s.id,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      SUPPLY_TYPE_LABELS[s.type] || s.type,
      `"${(s.category?.name || '').replace(/"/g, '""')}"`,
      s.unit || '',
      s.type === 'STOCK' ? s.currentQuantity : '',
      s.type === 'STOCK' ? s.minimumQuantity : '',
      `"${(s.supplier || '').replace(/"/g, '""')}"`,
      s.unitPrice ? Number(s.unitPrice).toFixed(2) : '',
      `"${(s.documentNumber || '').replace(/"/g, '""')}"`,
      `"${(s.notes || '').replace(/"/g, '""')}"`,
      new Date(s.createdAt).toLocaleDateString('th-TH'),
    ]);

    const csvContent = '﻿' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const dateStr = new Date().toISOString().split('T')[0];

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="supplies_export_${dateStr}.csv"`,
      },
    });
  } catch (error) {
    logger.error('Export supplies error', { error });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
