/**
 * ==================================================
 * API Route: /api/users/upload-profile
 * ==================================================
 * API สำหรับอัปโหลดรูปโปรไฟล์พนักงาน
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, isAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * POST /api/users/upload-profile
 * อัปโหลดรูปโปรไฟล์
 * 
 * FormData:
 * - file: ไฟล์รูปภาพ (jpg, png, webp)
 * - userId: ID ของผู้ใช้
 */
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
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;

    if (!file || !userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_INPUT',
          message: 'กรุณาระบุไฟล์และ ID ผู้ใช้',
        },
        { status: 400 }
      );
    }

    const targetUserId = parseInt(userId);

    // ตรวจสอบสิทธิ์ (เฉพาะ Admin หรือตัวเอง)
    if (!isAdmin(currentUser.role) && currentUser.id !== targetUserId) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: 'คุณไม่มีสิทธิ์อัปโหลดรูปโปรไฟล์ของผู้ใช้นี้',
        },
        { status: 403 }
      );
    }

    // ตรวจสอบประเภทไฟล์
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_FILE_TYPE',
          message: 'รองรับเฉพาะไฟล์ JPG, PNG, WEBP เท่านั้น',
        },
        { status: 400 }
      );
    }

    // ตรวจสอบขนาดไฟล์ (สูงสุด 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: 'FILE_TOO_LARGE',
          message: 'ขนาดไฟล์ต้องไม่เกิน 5MB',
        },
        { status: 400 }
      );
    }

    // สร้างโฟลเดอร์ถ้ายังไม่มี
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'profiles');
    await mkdir(uploadDir, { recursive: true });

    // สร้างชื่อไฟล์ unique
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `profile_${targetUserId}_${Date.now()}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // เขียนไฟล์
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // URL สำหรับเข้าถึงรูป
    const profileImageUrl = `/uploads/profiles/${fileName}`;

    // อัปเดต profileImage ในฐานข้อมูล
    const user = await prisma.user.update({
      where: { id: targetUserId },
      data: { profileImage: profileImageUrl },
      select: {
        id: true,
        email: true,
        username: true,
        prefix: true,
        name: true,
        role: true,
        department: true,
        division: true,
        position: true,
        positionSecond: true,
        positionLevel: true,
        avatar: true,
        profileImage: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: user,
      message: 'อัปโหลดรูปโปรไฟล์สำเร็จ',
    });
  } catch (error) {
    logger.error('Upload profile image error', { error });
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
