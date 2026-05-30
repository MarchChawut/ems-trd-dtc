/**
 * ==================================================
 * API Route: /api/assets/[id]
 * ==================================================
 * GET / PATCH / DELETE ครุภัณฑ์เดี่ยว
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAssetSchema } from '@/lib/security';
import { requireAuth, isManagerOrAbove } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const { id } = await params;

    const asset = await prisma.asset.findUnique({
      where: { id: parseInt(id) },
      include: {
        category: { select: { id: true, name: true } },
        currentHolder: { select: { id: true, prefix: true, name: true, avatar: true, department: true } },
        checkouts: {
          include: {
            holder: { select: { id: true, prefix: true, name: true, avatar: true, department: true } },
            issuedBy: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { checkedOutAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'NOT_FOUND', message: 'ไม่พบครุภัณฑ์' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { ...asset, acquisitionCost: asset.acquisitionCost ? Number(asset.acquisitionCost) : null },
    });
  } catch (error) {
    logger.error('Get asset error', { error });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const result = createAssetSchema.partial().safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'ข้อมูลไม่ถูกต้อง', details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const asset = await prisma.asset.update({
      where: { id: parseInt(id) },
      data: result.data,
      include: {
        category: { select: { id: true, name: true } },
        currentHolder: { select: { id: true, prefix: true, name: true, avatar: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: { ...asset, acquisitionCost: asset.acquisitionCost ? Number(asset.acquisitionCost) : null },
      message: 'อัปเดตครุภัณฑ์สำเร็จ',
    });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'NOT_FOUND', message: 'ไม่พบครุภัณฑ์' },
        { status: 404 }
      );
    }
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'DUPLICATE', message: 'รหัสครุภัณฑ์นี้มีอยู่แล้ว' },
        { status: 409 }
      );
    }
    logger.error('Update asset error', { error });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    await prisma.asset.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: 'ลบครุภัณฑ์สำเร็จ' });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'NOT_FOUND', message: 'ไม่พบครุภัณฑ์' },
        { status: 404 }
      );
    }
    logger.error('Delete asset error', { error });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
