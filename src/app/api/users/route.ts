/**
 * ==================================================
 * API Route: /api/users
 * ==================================================
 * API สำหรับจัดการข้อมูลผู้ใช้ (CRUD operations)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createUserSchema, hashPassword, generateAvatarInitials, sanitizeInput } from '@/lib/security';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/users
 * ดึงรายชื่อผู้ใช้ทั้งหมด
 * 
 * Query Parameters:
 * - search: ค้นหาด้วยชื่อหรืออีเมล
 * - role: กรองตามบทบาท
 * - department: กรองตามแผนก
 * - isActive: กรองตามสถานะ
 * 
 * Response:
 * {
 *   success: true,
 *   data: User[],
 *   meta: { total, page, limit }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // ตรวจสอบการเข้าสู่ระบบ
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    // ดึง query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const department = searchParams.get('department');
    const isActive = searchParams.get('isActive');

    // สร้าง where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { username: { contains: search } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (department) {
      where.department = department;
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    // ดึงข้อมูลผู้ใช้
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        department: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // นับจำนวนผู้ใช้ทั้งหมด
    const total = await prisma.user.count({ where });

    return NextResponse.json({
      success: true,
      data: users,
      meta: { total },
    });

  } catch (error) {
    logger.error('Get users error', { error });
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
 * POST /api/users
 * สร้างผู้ใช้ใหม่
 * 
 * Request Body:
 * {
 *   email: string;
 *   username: string;
 *   password: string;
 *   name: string;
 *   role: UserRole;
 *   department?: string;
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: User,
 *   message: 'สร้างผู้ใช้สำเร็จ'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ตรวจสอบการเข้าสู่ระบบ
    const authResult = await requireAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    // ตรวจสอบสิทธิ์ (เฉพาะ ADMIN และ SUPER_ADMIN เท่านั้น)
    if (!['ADMIN', 'SUPER_ADMIN'].includes(authResult.user!.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN',
          message: 'คุณไม่มีสิทธิ์สร้างผู้ใช้',
        },
        { status: 403 }
      );
    }

    // อ่านข้อมูลจาก request body
    const body = await request.json();

    // ตรวจสอบข้อมูลด้วย Zod Schema
    const validationResult = createUserSchema.safeParse(body);

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

    const { email, username, password, name, role, department } = validationResult.data;

    // ตรวจสอบว่าอีเมลซ้ำหรือไม่
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

    // ตรวจสอบว่าชื่อผู้ใช้ซ้ำหรือไม่
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      return NextResponse.json(
        {
          success: false,
          error: 'USERNAME_EXISTS',
          message: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว',
        },
        { status: 409 }
      );
    }

    // เข้ารหัสรหัสผ่าน
    const hashedPassword = await hashPassword(password);

    // สร้าง avatar
    const avatar = generateAvatarInitials(name);

    // สร้างผู้ใช้ใหม่
    const user = await prisma.user.create({
      data: {
        email: sanitizeInput(email),
        username: sanitizeInput(username),
        password: hashedPassword,
        name: sanitizeInput(name),
        role,
        department: department ? sanitizeInput(department) : null,
        avatar,
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        department: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: user,
        message: 'สร้างผู้ใช้สำเร็จ',
      },
      { status: 201 }
    );

  } catch (error) {
    logger.error('Create user error', { error });
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
