/**
 * ==================================================
 * API Route: POST /api/uploads/document
 * ==================================================
 * API สำหรับอัปโหลดเอกสาร PDF หรือรูปภาพ
 * ใช้กับพัสดุและครุภัณฑ์
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'INVALID_INPUT', message: 'กรุณาระบุไฟล์' },
        { status: 400 }
      );
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'INVALID_FILE_TYPE', message: 'รองรับเฉพาะไฟล์ PDF, JPG, PNG, WEBP เท่านั้น' },
        { status: 400 }
      );
    }

    const maxSize = file.type === 'application/pdf' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const limitLabel = file.type === 'application/pdf' ? '10MB' : '5MB';
      return NextResponse.json(
        { success: false, error: 'FILE_TOO_LARGE', message: `ขนาดไฟล์ต้องไม่เกิน ${limitLabel}` },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
    await mkdir(uploadDir, { recursive: true });

    const ext = file.type === 'application/pdf' ? 'pdf' : (file.name.split('.').pop() || 'jpg');
    const fileName = `doc_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const url = `/uploads/documents/${fileName}`;

    logger.info('Document uploaded', { fileName, size: file.size, userId: authResult.user!.id });

    return NextResponse.json({
      success: true,
      data: { url },
      message: 'อัปโหลดเอกสารสำเร็จ',
    });
  } catch (error) {
    logger.error('Upload document error', { error });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
