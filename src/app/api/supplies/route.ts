/**
 * ==================================================
 * API Route: /api/supplies
 * ==================================================
 * GET รายการพัสดุ / POST สร้างพัสดุ
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createSupplySchema } from '@/lib/security';
import { requireAuth, isManagerOrAbove } from '@/lib/auth';
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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const categoryId = searchParams.get('categoryId');
    const lowStock = searchParams.get('lowStock') === 'true';

    const where: any = { isActive: true };
    if (type) where.type = type;
    if (categoryId) where.categoryId = parseInt(categoryId);
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { supplier: { contains: search } },
        { documentNumber: { contains: search } },
      ];
    }

    let supplies = await prisma.supply.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { transactions: true } },
      },
      orderBy: { name: 'asc' },
    });

    if (lowStock) {
      supplies = supplies.filter(s => s.type === 'STOCK' && s.currentQuantity <= s.minimumQuantity);
    }

    const data = supplies.map(s => ({
      ...s,
      unitPrice: s.unitPrice ? Number(s.unitPrice) : null,
    }));

    return NextResponse.json({ success: true, data, meta: { total: data.length } });
  } catch (error) {
    logger.error('Get supplies error', { error });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
        { success: false, error: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์จัดการพัสดุ' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const result = createSupplySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'ข้อมูลไม่ถูกต้อง', details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data: Prisma.SupplyUncheckedCreateInput = {
      ...result.data,
      issueDate: result.data.issueDate ? new Date(result.data.issueDate) : null,
    };

    const supply = await prisma.supply.create({
      data,
      include: { category: { select: { id: true, name: true } } },
    });

    // Auto-create RECEIVE transaction when initial quantity > 0
    if (supply.currentQuantity > 0) {
      await prisma.supplyTransaction.create({
        data: {
          supplyId: supply.id,
          type: 'RECEIVE',
          quantity: supply.currentQuantity,
          quantityBefore: 0,
          quantityAfter: supply.currentQuantity,
          performedById: authResult.user!.id,
          recipientName: supply.recorderName || null,
          documentNumber: supply.documentNumber || null,
          documentUrl: supply.documentUrl || null,
          notes: 'บันทึกจำนวนเริ่มต้น',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: { ...supply, unitPrice: supply.unitPrice ? Number(supply.unitPrice) : null },
      message: 'สร้างพัสดุสำเร็จ',
    }, { status: 201 });
  } catch (error) {
    logger.error('Create supply error', { error });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
