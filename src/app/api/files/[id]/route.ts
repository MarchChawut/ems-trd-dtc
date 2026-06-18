/**
 * ==================================================
 * API Route: GET /api/files/[id]
 * ==================================================
 * เสิร์ฟไฟล์ (รูปภาพ/เอกสาร) ที่เก็บไว้เป็น byte ในฐานข้อมูล
 * ใช้คู่กับ POST /api/uploads/document
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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

    const file = await prisma.uploadedFile.findUnique({
      where: { id },
      select: { data: true, mimeType: true, fileName: true, size: true },
    });

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'NOT_FOUND', message: 'ไม่พบไฟล์' },
        { status: 404 }
      );
    }

    const body = new Uint8Array(file.data);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(file.size),
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.fileName)}"`,
        // เนื้อหาผูกกับ id ที่ไม่ซ้ำและไม่เปลี่ยน จึง cache ได้ยาว
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    logger.error('Serve file error', { error });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
