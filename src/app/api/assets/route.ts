/**
 * ==================================================
 * API Route: /api/assets
 * ==================================================
 * GET รายการครุภัณฑ์ / POST สร้างครุภัณฑ์
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAssetSchema } from '@/lib/security';
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
    const status = searchParams.get('status');
    const categoryId = searchParams.get('categoryId');
    const department = searchParams.get('department');
    const search = searchParams.get('search');

    const where: any = { isActive: true };
    if (status) where.status = status;
    if (categoryId) where.categoryId = parseInt(categoryId);
    if (department) where.department = { contains: department };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { assetTag: { contains: search } },
        { serialNumber: { contains: search } },
        { model: { contains: search } },
        { brand: { contains: search } },
        { documentNumber: { contains: search } },
      ];
    }

    const assets = await prisma.asset.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        currentHolder: { select: { id: true, prefix: true, name: true, avatar: true } },
      },
      orderBy: { name: 'asc' },
    });

    const data = assets.map(a => ({
      ...a,
      acquisitionCost: a.acquisitionCost ? Number(a.acquisitionCost) : null,
    }));

    return NextResponse.json({ success: true, data, meta: { total: data.length } });
  } catch (error) {
    logger.error('Get assets error', { error });
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
        { success: false, error: 'FORBIDDEN', message: 'คุณไม่มีสิทธิ์จัดการครุภัณฑ์' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const result = createAssetSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'ข้อมูลไม่ถูกต้อง', details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const d = result.data;
    const asset = await prisma.asset.create({
      data: {
        name: d.name,
        assetTag: d.assetTag ?? null,
        serialNumber: d.serialNumber ?? null,
        model: d.model ?? null,
        brand: d.brand ?? null,
        ...(d.categoryId != null ? { categoryId: d.categoryId } : {}),
        status: d.status ?? 'AVAILABLE',
        condition: d.condition ?? 'GOOD',
        acquisitionDate: d.acquisitionDate ? new Date(d.acquisitionDate) : null,
        acquisitionCost: d.acquisitionCost ?? null,
        documentNumber: d.documentNumber ?? null,
        documentUrl: d.documentUrl ?? null,
        imageUrl: d.imageUrl ?? null,
        location: d.location ?? null,
        department: d.department ?? null,
        notes: d.notes ?? null,
        receiverName: d.receiverName ?? null,
        lastInspectionDate: d.lastInspectionDate ? new Date(d.lastInspectionDate) : null,
        lastInspectionCondition: d.lastInspectionCondition ?? null,
        lastInspectedBy: d.lastInspectedBy ?? null,
      },
      include: {
        category: { select: { id: true, name: true } },
        currentHolder: { select: { id: true, prefix: true, name: true, avatar: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: { ...asset, acquisitionCost: asset.acquisitionCost ? Number(asset.acquisitionCost) : null },
      message: 'สร้างครุภัณฑ์สำเร็จ',
    }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'DUPLICATE', message: 'รหัสครุภัณฑ์นี้มีอยู่แล้ว' },
        { status: 409 }
      );
    }
    logger.error('Create asset error', { error });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
