/**
 * ==================================================
 * API Route: GET /api/dashboard
 * ==================================================
 * API สำหรับดึงข้อมูลสถิติแดชบอร์ด
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/dashboard
 * ดึงข้อมูลสถิติสำหรับแดชบอร์ด
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     stats: {
 *       totalUsers: number;
 *       activeUsers: number;
 *       pendingLeaves: number;
 *       totalLeaves: number;
 *       totalTasks: number;
 *       tasksByColumn: { columnId, columnName, count }[];
 *     }
 *   }
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

    // ดึงข้อมูลสถิติพร้อมกัน
    const [
      totalUsers,
      activeUsers,
      pendingLeaves,
      totalLeaves,
      totalTasks,
      columns,
      stockSupplies,
      assetsInUse,
      assetsInRepair,
      overdueCheckoutsRows,
      overdueCheckoutsCount,
    ] = await Promise.all([
      // จำนวนผู้ใช้ทั้งหมด
      prisma.user.count(),

      // จำนวนผู้ใช้ที่ active
      prisma.user.count({ where: { isActive: true } }),

      // จำนวนการลาที่รออนุมัติ
      prisma.leave.count({ where: { status: 'PENDING' } }),

      // จำนวนการลาทั้งหมด
      prisma.leave.count(),

      // จำนวนงานทั้งหมด
      prisma.task.count(),

      // คอลัมน์ทั้งหมดพร้อมจำนวนงาน
      prisma.kanbanColumn.findMany({
        include: {
          _count: {
            select: { tasks: true },
          },
        },
        orderBy: { order: 'asc' },
      }),

      // พัสดุประเภท STOCK ทั้งหมด (กรองใกล้หมดใน JS)
      prisma.supply.findMany({
        where: { isActive: true, type: 'STOCK' },
        include: {
          category: { select: { id: true, name: true } },
        },
      }),

      // ครุภัณฑ์ที่กำลังใช้งานอยู่
      prisma.asset.count({ where: { isActive: true, status: 'IN_USE' } }),

      // ครุภัณฑ์ที่กำลังซ่อม
      prisma.asset.count({ where: { isActive: true, status: 'IN_REPAIR' } }),

      // รายการยืมครุภัณฑ์ที่เกินกำหนดคืน (top 5)
      prisma.assetCheckout.findMany({
        where: { returnedAt: null, expectedReturnAt: { lt: new Date() } },
        include: {
          asset: { select: { id: true, name: true, assetTag: true } },
          holder: { select: { id: true, name: true, avatar: true, department: true } },
        },
        orderBy: { expectedReturnAt: 'asc' },
        take: 5,
      }),

      // จำนวนรวมของรายการยืมครุภัณฑ์ที่เกินกำหนดคืน
      prisma.assetCheckout.count({
        where: { returnedAt: null, expectedReturnAt: { lt: new Date() } },
      }),
    ]);

    // แปลงข้อมูล tasksByColumn
    const tasksByColumn = columns.map(col => ({
      columnId: col.id,
      columnName: col.name,
      count: col._count.tasks,
    }));

    // กรองพัสดุใกล้หมด (currentQuantity <= minimumQuantity)
    const lowStockSuppliesAll = stockSupplies
      .filter(s => s.currentQuantity <= s.minimumQuantity)
      .sort((a, b) => (a.currentQuantity - a.minimumQuantity) - (b.currentQuantity - b.minimumQuantity));

    const lowStockSupplies = lowStockSuppliesAll.slice(0, 5).map(s => ({
      id: s.id,
      name: s.name,
      unit: s.unit,
      currentQuantity: s.currentQuantity,
      minimumQuantity: s.minimumQuantity,
      category: s.category,
    }));

    // ดึงข้อมูลการลาล่าสุดที่รออนุมัติ (5 รายการ)
    const recentPendingLeaves = await prisma.leave.findMany({
      where: { status: 'PENDING' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            department: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // ดึงข้อมูลงานล่าสุด (5 รายการ)
    const recentTasks = await prisma.task.findMany({
      include: {
        column: true,
        assignee: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeUsers,
          pendingLeaves,
          totalLeaves,
          totalTasks,
          tasksByColumn,
          lowStockCount: lowStockSuppliesAll.length,
          assetsInUse,
          assetsInRepair,
          overdueCheckoutsCount,
        },
        recentPendingLeaves,
        recentTasks,
        lowStockSupplies,
        overdueCheckouts: overdueCheckoutsRows,
      },
    });

  } catch (error) {
    logger.error('Dashboard error', { error });
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
