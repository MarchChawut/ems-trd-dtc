/**
 * ==================================================
 * API Route: /api/users/[id]
 * ==================================================
 * API สำหรับจัดการผู้ใช้เดี่ยว (ดู, อัปเดต, ลบ)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sanitizeInput, hashPassword } from '@/lib/security';
import { requireAuth, isAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Schema สำหรับอัปเดตผู้ใช้
const updateUserSchema = z.object({
  email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').optional(),
  prefix: z.string().max(50).nullable().optional(),
  name: z.string().min(1, 'กรุณาระบุชื่อ').max(100).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'HR']).optional(),
  department: z.string().max(100).nullable().optional(),
  division: z.string().max(200).nullable().optional(),
  position: z.string().max(100).nullable().optional(),
  positionSecond: z.string().max(100).nullable().optional(),
  positionLevel: z.number().int().min(1).max(11).nullable().optional(),
  profileImage: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').optional(),
});

/**
 * GET /api/users/[id]
 * ดึงข้อมูลผู้ใช้ตาม ID
 * 
 * Response:
 * {
 *   success: true,
 *   data: User
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ตรวจสอบการเข้าสู่ระบบ
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_ID',
          message: 'รหัสผู้ใช้ไม่ถูกต้อง',
        },
        { status: 400 }
      );
    }

    // ดึงข้อมูลผู้ใช้
    const user = await prisma.user.findUnique({
      where: { id: userId },
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

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'ไม่พบผู้ใช้',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });

  } catch (error) {
    logger.error('Get user error', { error });
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

/**
 * PATCH /api/users/[id]
 * อัปเดตข้อมูลผู้ใช้
 * 
 * Request Body:
 * {
 *   email?: string;
 *   name?: string;
 *   role?: UserRole;
 *   department?: string;
 *   isActive?: boolean;
 *   password?: string;
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: User,
 *   message: 'อัปเดตผู้ใช้สำเร็จ'
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ตรวจสอบการเข้าสู่ระบบ
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const currentUser = authResult.user!;
    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_ID',
          message: 'รหัสผู้ใช้ไม่ถูกต้อง',
        },
        { status: 400 }
      );
    }

    // ตรวจสอบสิทธิ์ (เฉพาะ ADMIN หรือตัวเองเท่านั้น)
    if (!isAdmin(currentUser.role) && currentUser.id !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: 'คุณไม่มีสิทธิ์แก้ไขผู้ใช้นี้',
        },
        { status: 403 }
      );
    }

    // ตรวจสอบว่าผู้ใช้มีอยู่หรือไม่
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'ไม่พบผู้ใช้',
        },
        { status: 404 }
      );
    }

    // อ่านข้อมูลจาก request body
    const body = await request.json();

    // ตรวจสอบข้อมูลด้วย Zod Schema
    const validationResult = updateUserSchema.safeParse(body);

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

    const { email, name, role, department, isActive, password } = validationResult.data;

    // ตรวจสอบว่าอีเมลซ้ำหรือไม่ (ถ้ามีการเปลี่ยนอีเมล)
    if (email && email !== existingUser.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (existingEmail) {
        return NextResponse.json(
          {
            success: false,
            error: 'EMAIL_EXISTS',
            message: 'อีเมลนี้ถูกใช้งานแล้ว',
          },
          { status: 409 }
        );
      }
    }

    // สร้างข้อมูลสำหรับอัปเดต
    const updateData: any = {};

    if (email !== undefined) {
      updateData.email = sanitizeInput(email);
    }

    if (name !== undefined) {
      updateData.name = sanitizeInput(name);
    }

    // เฉพาะ ADMIN เท่านั้นที่สามารถเปลี่ยน role และ isActive
    if (isAdmin(currentUser.role)) {
      if (role !== undefined) {
        updateData.role = role;
      }

      if (isActive !== undefined) {
        updateData.isActive = isActive;
      }
    }

    if (validationResult.data.prefix !== undefined) {
      updateData.prefix = validationResult.data.prefix ? sanitizeInput(validationResult.data.prefix) : null;
    }

    if (department !== undefined) {
      updateData.department = department ? sanitizeInput(department) : null;
    }

    if (validationResult.data.division !== undefined) {
      updateData.division = validationResult.data.division ? sanitizeInput(validationResult.data.division) : null;
    }

    if (validationResult.data.position !== undefined) {
      updateData.position = validationResult.data.position ? sanitizeInput(validationResult.data.position) : null;
    }

    if (validationResult.data.positionSecond !== undefined) {
      updateData.positionSecond = validationResult.data.positionSecond ? sanitizeInput(validationResult.data.positionSecond) : null;
    }

    if (validationResult.data.positionLevel !== undefined) {
      updateData.positionLevel = validationResult.data.positionLevel;
    }

    if (validationResult.data.profileImage !== undefined) {
      updateData.profileImage = validationResult.data.profileImage;
    }

    if (password !== undefined) {
      updateData.password = await hashPassword(password);
    }

    // อัปเดตผู้ใช้
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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
      message: 'อัปเดตผู้ใช้สำเร็จ',
    });

  } catch (error) {
    logger.error('Update user error', { error });
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

/**
 * DELETE /api/users/[id]
 * ลบผู้ใช้
 * 
 * Response:
 * {
 *   success: true,
 *   message: 'ลบผู้ใช้สำเร็จ'
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ตรวจสอบการเข้าสู่ระบบ
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    const currentUser = authResult.user!;
    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_ID',
          message: 'รหัสผู้ใช้ไม่ถูกต้อง',
        },
        { status: 400 }
      );
    }

    // ตรวจสอบสิทธิ์ (เฉพาะ ADMIN เท่านั้น)
    if (!isAdmin(currentUser.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: 'คุณไม่มีสิทธิ์ลบผู้ใช้',
        },
        { status: 403 }
      );
    }

    // ไม่สามารถลบตัวเองได้
    if (currentUser.id === userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'CANNOT_DELETE_SELF',
          message: 'ไม่สามารถลบบัญชีตัวเองได้',
        },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าผู้ใช้มีอยู่หรือไม่
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'ไม่พบผู้ใช้',
        },
        { status: 404 }
      );
    }

    // ลบผู้ใช้ (Prisma จะลบข้อมูลที่เกี่ยวข้องอัตโนมัติตาม onDelete: Cascade)
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: 'ลบผู้ใช้สำเร็จ',
    });

  } catch (error) {
    logger.error('Delete user error', { error });
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
