/**
 * ==================================================
 * API Route: POST /api/auth/change-password
 * ==================================================
 * เปลี่ยนรหัสผ่านของตนเอง (ต้องกรอกรหัสผ่านเดิมเพื่อยืนยัน)
 * ใช้ได้ทั้งพนักงานและผู้ดูแลระบบทุกระดับ
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { changePasswordSchema, hashPassword, verifyPassword } from '@/lib/security';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const currentUser = authResult.user!;

    const body = await request.json();
    const validationResult = changePasswordSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'ข้อมูลไม่ถูกต้อง',
          details: errors,
        },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validationResult.data;

    const user = await prisma.user.findUnique({ where: { id: currentUser.id } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'USER_NOT_FOUND', message: 'ไม่พบผู้ใช้' },
        { status: 404 }
      );
    }

    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_CURRENT_PASSWORD',
          message: 'รหัสผ่านเดิมไม่ถูกต้อง',
        },
        { status: 401 }
      );
    }

    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { password: hashedPassword },
    });

    logger.info('Password changed by user', { userId: currentUser.id });

    return NextResponse.json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านสำเร็จ',
    });

  } catch (error) {
    logger.error('Change password error', { error });
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
