/**
 * ==================================================
 * API Route: GET /api/assets/export
 * ==================================================
 * Export รายการครุภัณฑ์เป็น CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, isManagerOrAbove } from '@/lib/auth';
import { logger } from '@/lib/logger';

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'พร้อมใช้งาน',
  IN_USE: 'ถูกใช้งาน',
  IN_REPAIR: 'ส่งซ่อม',
  RETURNED: 'ส่งคืนคลัง',
  DISPOSED: 'ตัดจำหน่าย',
};

const CONDITION_LABELS: Record<string, string> = {
  EXCELLENT: 'ดีมาก',
  GOOD: 'ดี',
  FAIR: 'พอใช้',
  POOR: 'ไม่ดี',
  DAMAGED: 'เสียหาย',
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
    const status = searchParams.get('status');

    const where: any = { isActive: true };
    if (status) where.status = status;

    const assets = await prisma.asset.findMany({
      where,
      include: {
        category: { select: { name: true } },
        currentHolder: { select: { prefix: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const headers = [
      'รหัส', 'ชื่อครุภัณฑ์', 'รหัสครุภัณฑ์', 'หมายเลขซีเรียล', 'ยี่ห้อ', 'รุ่น',
      'หมวดหมู่', 'สถานะ', 'สภาพ', 'ผู้ครอบครอง', 'แผนก', 'สถานที่',
      'วันที่จัดซื้อ', 'ราคา', 'เลขที่เอกสาร',
    ];

    const rows = assets.map(a => [
      a.id,
      `"${(a.name || '').replace(/"/g, '""')}"`,
      `"${(a.assetTag || '').replace(/"/g, '""')}"`,
      `"${(a.serialNumber || '').replace(/"/g, '""')}"`,
      `"${(a.brand || '').replace(/"/g, '""')}"`,
      `"${(a.model || '').replace(/"/g, '""')}"`,
      `"${(a.category?.name || '').replace(/"/g, '""')}"`,
      STATUS_LABELS[a.status] || a.status,
      CONDITION_LABELS[a.condition] || a.condition,
      `"${((a.currentHolder?.prefix || '') + (a.currentHolder?.name || '')).replace(/"/g, '""')}"`,
      `"${(a.department || '').replace(/"/g, '""')}"`,
      `"${(a.location || '').replace(/"/g, '""')}"`,
      a.acquisitionDate ? new Date(a.acquisitionDate).toLocaleDateString('th-TH') : '',
      a.acquisitionCost ? Number(a.acquisitionCost).toFixed(2) : '',
      `"${(a.documentNumber || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '﻿' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const dateStr = new Date().toISOString().split('T')[0];

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="assets_export_${dateStr}.csv"`,
      },
    });
  } catch (error) {
    logger.error('Export assets error', { error });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
