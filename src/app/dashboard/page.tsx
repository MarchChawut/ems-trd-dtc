/**
 * ==================================================
 * Dashboard Page - หน้าแดชบอร์ดหลัก
 * ==================================================
 * แสดงสถิติสำคัญและเมนูด่วนของระบบ EMS
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Calendar, 
  CheckCircle, 
  Clock,
  Briefcase,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardStats } from '@/types';

/**
 * ข้อมูลสถิติเริ่มต้น
 */
const defaultStats: DashboardStats = {
  totalUsers: 0,
  activeUsers: 0,
  pendingLeaves: 0,
  totalLeaves: 0,
  inProgressTasks: 0,
  doneTasks: 0,
  totalTasks: 0,
};

/**
 * หน้าแดชบอร์ดหลัก
 * แสดงสถิติและเมนูด่วนสำหรับการจัดการระบบ
 */
export default function DashboardPage() {
  const router = useRouter();
  
  // State สำหรับเก็บข้อมูลสถิติ
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  
  // State สำหรับสถานะการโหลด
  const [isLoading, setIsLoading] = useState(true);
  
  // State สำหรับข้อผิดพลาด
  const [error, setError] = useState<string | null>(null);

  /**
   * ดึงข้อมูลสถิติจาก API
   */
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();
        
        if (!response.ok) {
          if (response.status === 401) {
            // ไม่ได้เข้าสู่ระบบ - ไปหน้า login
            router.push('/');
            return;
          }
          throw new Error(data.message || 'ไม่สามารถดึงข้อมูลได้');
        }
        
        if (data.success) {
          setStats(data.data.stats);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [router]);

  // แสดง loading ขณะโหลดข้อมูล
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // ข้อมูลการ์ดสถิติ
  const statCards = [
    {
      title: 'พนักงานทั้งหมด',
      value: stats.totalUsers,
      subtext: `${stats.activeUsers} คนกำลังใช้งาน`,
      icon: Users,
      color: 'indigo',
      borderColor: 'border-indigo-500',
      bgColor: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      title: 'คำขอลา (รออนุมัติ)',
      value: stats.pendingLeaves,
      subtext: `จากทั้งหมด ${stats.totalLeaves} รายการ`,
      icon: Calendar,
      color: 'amber',
      borderColor: 'border-amber-500',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      title: 'งานที่กำลังทำ',
      value: stats.inProgressTasks,
      subtext: 'Projects On-going',
      icon: Clock,
      color: 'blue',
      borderColor: 'border-blue-500',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      title: 'งานเสร็จสิ้น',
      value: stats.doneTasks,
      subtext: `จากทั้งหมด ${stats.totalTasks} งาน`,
      icon: CheckCircle,
      color: 'emerald',
      borderColor: 'border-emerald-500',
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
  ];

  // ข้อมูลเมนูด่วน
  const quickActions = [
    {
      title: 'จัดการการลา',
      description: 'ดูและจัดการคำขอลาทั้งหมด',
      icon: Calendar,
      href: '/dashboard/leaves',
      color: 'indigo',
      bgColor: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
    },
    {
      title: 'จัดการงาน',
      description: 'ดูและจัดการงานในระบบ Kanban',
      icon: CheckCircle,
      href: '/dashboard/tasks',
      color: 'blue',
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      title: 'ดูรายชื่อพนักงาน',
      description: 'จัดการข้อมูลพนักงานทั้งหมด',
      icon: Users,
      href: '/dashboard/employees',
      color: 'emerald',
      bgColor: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* หัวข้อหน้า */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">แดชบอร์ด</h1>
        <p className="text-slate-500 mt-1">
          ภาพรวมของระบบจัดการพนักงาน
        </p>
      </div>

      {/* แสดงข้อผิดพลาด */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
          <p className="text-rose-600">{error}</p>
        </div>
      )}

      {/* การ์ดสถิติ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div
            key={index}
            className={cn(
              "bg-white rounded-xl p-6 shadow-sm border border-slate-200",
              "border-l-4",
              card.borderColor,
              "hover:shadow-md transition-shadow"
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-500 text-sm mb-1">{card.title}</p>
                <h3 className="text-3xl font-bold text-slate-800">
                  {card.value}
                </h3>
                <p className="text-xs text-slate-400 mt-2">{card.subtext}</p>
              </div>
              <div className={cn("p-3 rounded-lg", card.bgColor)}>
                <card.icon className={cn("w-6 h-6", card.iconColor)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* เมนูด่วน */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">
          เมนูด่วน (Quick Actions)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => router.push(action.href)}
              className={cn(
                "p-4 rounded-xl border border-slate-200 text-left",
                "hover:border-slate-300 hover:shadow-md",
                "transition-all duration-200 group"
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn("p-3 rounded-lg", action.bgColor)}>
                  <action.icon className={cn("w-6 h-6", action.iconColor)} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {action.description}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ข้อมูลเพิ่มเติม */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* การลาล่าสุดที่รออนุมัติ */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">
              การลารออนุมัติ
            </h2>
            <button
              onClick={() => router.push('/dashboard/leaves')}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              ดูทั้งหมด
            </button>
          </div>
          {stats.pendingLeaves > 0 ? (
            <p className="text-slate-500">
              มีคำขอลาจำนวน {stats.pendingLeaves} รายการที่รอการอนุมัติ
            </p>
          ) : (
            <p className="text-slate-400 text-center py-8">
              ไม่มีคำขอลาที่รออนุมัติ
            </p>
          )}
        </div>

        {/* งานที่กำลังดำเนินการ */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">
              งานที่กำลังดำเนินการ
            </h2>
            <button
              onClick={() => router.push('/dashboard/tasks')}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              ดูทั้งหมด
            </button>
          </div>
          {stats.inProgressTasks > 0 ? (
            <p className="text-slate-500">
              มีงานจำนวน {stats.inProgressTasks} งานที่กำลังดำเนินการ
            </p>
          ) : (
            <p className="text-slate-400 text-center py-8">
              ไม่มีงานที่กำลังดำเนินการ
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
