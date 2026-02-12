/**
 * ==================================================
 * Dashboard Page - หน้าแดชบอร์ดหลัก
 * ==================================================
 * แสดงกราฟสถิติการลาแยกประเภท ในปีงบประมาณปัจจุบัน
 */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Calendar,
  Clock,
  CheckCircle,
  Loader2,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardStats } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

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
 * สีสำหรับแต่ละประเภทการลา
 */
const leaveTypeConfig: Record<string, { label: string; color: string; bgClass: string }> = {
  SICK: { label: 'ลาป่วย', color: '#ef4444', bgClass: 'bg-red-500' },
  PERSONAL: { label: 'ลากิจ', color: '#f97316', bgClass: 'bg-orange-500' },
  MATERNITY: { label: 'ลาคลอดบุตร', color: '#ec4899', bgClass: 'bg-pink-500' },
  VACATION: { label: 'ลาพักร้อน', color: '#10b981', bgClass: 'bg-emerald-500' },
  ORDINATION: { label: 'ลาบวช', color: '#8b5cf6', bgClass: 'bg-violet-500' },
  OTHER: { label: 'ลาอื่นๆ', color: '#64748b', bgClass: 'bg-slate-500' },
};


interface LeaveRecord {
  id: number;
  userId: number;
  userName: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  isHalfDay: boolean;
  hours: number | null;
  status: string;
  month: number;
  year: number;
}

/**
 * ฟอร์แมตจำนวนวัน (รองรับครึ่งวัน/ชม.)
 */
function fmtDays(days: number): string {
  if (days === 0) return '0';
  if (days % 1 === 0) return `${days}`;
  return days.toFixed(1);
}

interface UserInfo {
  userId: number;
  userName: string;
  avatar: string | null;
  department: string | null;
}

interface UserSummary {
  userId: number;
  userName: string;
  avatar: string | null;
  department: string | null;
  byType: Record<string, { count: number; days: number }>;
  totalCount: number;
  totalDays: number;
}

interface LeaveStatsData {
  fiscalYear: string;
  fiscalMonths: string[];
  chartData: Record<string, any>[];
  users: UserInfo[];
  userSummaries: UserSummary[];
  leaves: LeaveRecord[];
}


/**
 * หน้าแดชบอร์ดหลัก
 * แสดงกราฟสถิติการลาในปีงบประมาณ
 */
export default function DashboardPage() {
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [leaveStats, setLeaveStats] = useState<LeaveStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ตัวกรอง
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');

  /**
   * ดึงข้อมูลสถิติจาก API
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, leaveRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/dashboard/leave-stats'),
        ]);

        const dashData = await dashRes.json();
        const leaveData = await leaveRes.json();

        if (!dashRes.ok) {
          if (dashRes.status === 401) {
            router.push('/');
            return;
          }
          throw new Error(dashData.message || 'ไม่สามารถดึงข้อมูลได้');
        }

        if (dashData.success) {
          setStats(dashData.data.stats);
        }

        if (leaveData.success) {
          setLeaveStats(leaveData.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [router]);

  /**
   * กรองข้อมูลการลาตามเดือน
   */
  const filteredLeaves = useMemo(() => {
    if (!leaveStats) return [];
    let leaves = leaveStats.leaves;

    if (selectedMonth !== 'ALL') {
      const [mIdx, yr] = selectedMonth.split('-').map(Number);
      leaves = leaves.filter((l) => l.month === mIdx && l.year === yr);
    }

    return leaves;
  }, [leaveStats, selectedMonth]);

  /**
   * สร้างข้อมูลกราฟ "รายบุคคล" — X-axis = ชื่อคน, แท่งแยกตามประเภทลา (grouped)
   */
  const chartDataByPerson = useMemo(() => {
    if (!leaveStats) return [];

    // กรองตามเดือนถ้าเลือก
    let relevantLeaves = leaveStats.leaves;
    if (selectedMonth !== 'ALL') {
      const [mIdx, yr] = selectedMonth.split('-').map(Number);
      relevantLeaves = relevantLeaves.filter((l) => l.month === mIdx && l.year === yr);
    }

    // หา users ที่มีการลา
    const userIds = Array.from(new Set(relevantLeaves.map((l) => l.userId)));

    return userIds.map((userId) => {
      const user = leaveStats.users.find((u) => u.userId === userId);
      const userLeaves = relevantLeaves.filter((l) => l.userId === userId);
      const row: Record<string, any> = { name: user?.userName || `User ${userId}` };

      for (const type of Object.keys(leaveTypeConfig)) {
        const typeLeaves = userLeaves.filter((l) => l.type === type);
        if (typeLeaves.length > 0) {
          const days = typeLeaves.reduce((s, l) => s + l.days, 0);
          row[type] = Math.round(days * 100) / 100;
        }
      }

      return row;
    });
  }, [leaveStats, selectedMonth]);

  /**
   * สร้างตารางสรุปรายคน (เฉพาะคนที่มีการลา)
   */
  const userTableData = useMemo(() => {
    if (!leaveStats) return [];

    return leaveStats.userSummaries
      .filter((u) => u.totalCount > 0)
      .map((u) => ({ ...u, totalDays: Math.round(u.totalDays * 100) / 100 }))
      .sort((a, b) => b.totalDays - a.totalDays);
  }, [leaveStats]);

  // fiscal months สำหรับ dropdown
  const fiscalMonthOptions = useMemo(() => {
    if (!leaveStats) return [];
    return leaveStats.chartData.map((fm) => ({
      label: fm.month as string,
      value: `${fm.monthIndex}-${fm.year}`,
    }));
  }, [leaveStats]);

  // ประเภทลาที่มีข้อมูลจริง (สำหรับแสดงแท่งในกราฟ)
  const activeLeaveTypes = Object.keys(leaveTypeConfig).filter((type) =>
    leaveStats?.leaves.some((l) => l.type === type),
  );

  // แสดง loading
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
      borderColor: 'border-indigo-500',
      bgColor: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      title: 'คำขอลา (รออนุมัติ)',
      value: stats.pendingLeaves,
      subtext: `จากทั้งหมด ${stats.totalLeaves} รายการ`,
      icon: Calendar,
      borderColor: 'border-amber-500',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      title: 'งานทั้งหมด',
      value: stats.totalTasks,
      subtext: 'Projects On-going',
      icon: Clock,
      borderColor: 'border-blue-500',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      title: 'คอลัมน์ใน Kanban',
      value: stats.tasksByColumn?.length || 0,
      subtext: 'จัดการงาน',
      icon: CheckCircle,
      borderColor: 'border-emerald-500',
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* หัวข้อหน้า */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">แดชบอร์ด</h1>
        <p className="text-slate-500 mt-1">
          ภาพรวมของระบบจัดการพนักงาน
          {leaveStats && (
            <span className="ml-2 text-indigo-600 font-medium">
              ปีงบประมาณ {leaveStats.fiscalYear}
            </span>
          )}
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
              "hover:shadow-md transition-shadow",
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-500 text-sm mb-1">{card.title}</p>
                <h3 className="text-3xl font-bold text-slate-800">{card.value}</h3>
                <p className="text-xs text-slate-400 mt-2">{card.subtext}</p>
              </div>
              <div className={cn("p-3 rounded-lg", card.bgColor)}>
                <card.icon className={cn("w-6 h-6", card.iconColor)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* กราฟสถิติการลา — แท่งแยกตามประเภทลาต่อคน (grouped) */}
      {leaveStats && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {/* Header + Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                สถิติการลาในปีงบประมาณ {leaveStats.fiscalYear}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                แสดงจำนวนวันลา (วันทำการ) แยกรายบุคคล — แสดงเฉพาะคนที่มีการลา
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* ตัวกรองเดือน */}
              <div className="flex items-center gap-1.5">
                <Filter size={14} className="text-slate-400" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">ทั้งปีงบประมาณ</option>
                  {fiscalMonthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3">
                {activeLeaveTypes.map((type) => (
                  <div key={type} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: leaveTypeConfig[type].color }}
                    />
                    <span className="text-slate-600">{leaveTypeConfig[type].label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chart */}
          {chartDataByPerson.length > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={Math.max(400, chartDataByPerson.length * 60)}>
                <BarChart
                  data={chartDataByPerson}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  barCategoryGap="20%"
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: 'วัน',
                      position: 'insideBottomRight',
                      offset: -5,
                      style: { fontSize: 12, fill: '#94a3b8' },
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 13, fill: '#334155' }}
                    tickLine={false}
                    axisLine={false}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '13px',
                    }}
                    formatter={(value: any, name?: string) => {
                      const cfg = leaveTypeConfig[name || ''];
                      return [`${fmtDays(value)} วัน`, cfg?.label || name];
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const cfg = leaveTypeConfig[value];
                      return cfg?.label || value;
                    }}
                    wrapperStyle={{ fontSize: '13px' }}
                  />

                  {activeLeaveTypes.map((type) => (
                    <Bar
                      key={type}
                      dataKey={type}
                      fill={leaveTypeConfig[type].color}
                      radius={[0, 4, 4, 0]}
                      barSize={16}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">ไม่มีข้อมูลการลาในช่วงที่เลือก</p>
            </div>
          )}
        </div>
      )}

      {/* ตารางสรุปรายคน */}
      {leaveStats && userTableData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">
            สรุปการลารายบุคคล
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">ชื่อ</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">หน่วยงาน</th>
                  {Object.entries(leaveTypeConfig).map(([type, cfg]) => {
                    const hasData = userTableData.some(
                      (u) => u.byType[type] && u.byType[type].count > 0,
                    );
                    if (!hasData) return null;
                    return (
                      <th key={type} className="text-center py-3 px-3 font-semibold text-slate-600">
                        <span className="flex items-center justify-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: leaveTypeConfig[type].color }}
                          />
                          {cfg.label}
                        </span>
                      </th>
                    );
                  })}
                  <th className="text-center py-3 px-4 font-semibold text-slate-600">รวม (ครั้ง)</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-600">รวม (วัน)</th>
                </tr>
              </thead>
              <tbody>
                {userTableData.map((u, idx) => {
                  // ถ้าเลือกเดือน ให้กรองข้อมูลเฉพาะเดือนนั้น
                  let displayData = u;
                  if (selectedMonth !== 'ALL') {
                    const [mIdx, yr] = selectedMonth.split('-').map(Number);
                    const monthLeaves = filteredLeaves.filter(
                      (l) => l.userId === u.userId && l.month === mIdx && l.year === yr,
                    );
                    if (monthLeaves.length === 0) return null;

                    const byType: Record<string, { count: number; days: number }> = {};
                    for (const l of monthLeaves) {
                      if (!byType[l.type]) byType[l.type] = { count: 0, days: 0 };
                      byType[l.type].count++;
                      byType[l.type].days += l.days;
                    }
                    displayData = {
                      ...u,
                      byType,
                      totalCount: monthLeaves.length,
                      totalDays: Math.round(monthLeaves.reduce((s, l) => s + l.days, 0) * 100) / 100,
                    };
                  }

                  return (
                    <tr
                      key={u.userId}
                      className={cn(
                        "border-b border-slate-100 hover:bg-slate-50 transition-colors",
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-25',
                      )}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                            {u.avatar || u.userName.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-800">{u.userName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{u.department || '-'}</td>
                      {Object.entries(leaveTypeConfig).map(([type]) => {
                        const hasData = userTableData.some(
                          (uu) => uu.byType[type] && uu.byType[type].count > 0,
                        );
                        if (!hasData) return null;
                        const typeData = displayData.byType[type];
                        return (
                          <td key={type} className="text-center py-3 px-3 text-slate-600">
                            {typeData && typeData.count > 0
                              ? `${typeData.count}/${fmtDays(typeData.days)}`
                              : '-'}
                          </td>
                        );
                      })}
                      <td className="text-center py-3 px-4 font-semibold text-slate-700">
                        {displayData.totalCount}
                      </td>
                      <td className="text-center py-3 px-4 font-semibold text-indigo-600">
                        {fmtDays(displayData.totalDays)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ไม่มีข้อมูลการลา */}
      {leaveStats && chartDataByPerson.length === 0 && !isLoading && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">ไม่มีข้อมูลการลาในปีงบประมาณนี้</p>
        </div>
      )}
    </div>
  );
}
