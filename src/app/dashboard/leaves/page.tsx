/**
 * ==================================================
 * Leaves Page - หน้าบันทึกการลา (อัปเดตเวอร์ชันใหม่)
 * ==================================================
 * เพิ่มฟีเจอร์:
 * - Dashboard สถิติรายบุคคล
 * - ค้นหาด้วยชื่อหรือวันที่
 * - เลือกชื่อผู้ขอลาได้
 * - Export ข้อมูลการลา
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Loader2,
  AlertCircle,
  Calendar,
  X,
  Search,
  Users,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Leave, LeaveType, LeaveStatus, User, Holiday } from '@/types';
import LeaveForm from '@/components/leaves/LeaveForm';

/**
 * สีและข้อความของประเภทการลา
 */
const leaveTypeConfig: Record<LeaveType, { label: string; bg: string; text: string; icon: string }> = {
  SICK: { label: 'ลาป่วย', bg: 'bg-rose-100', text: 'text-rose-600', icon: '🏥' },
  PERSONAL: { label: 'ลากิจ', bg: 'bg-amber-100', text: 'text-amber-600', icon: '💼' },
  VACATION: { label: 'ลาพักร้อน', bg: 'bg-blue-100', text: 'text-blue-600', icon: '🏖️' },
  MATERNITY: { label: 'ลาคลอดบุตร', bg: 'bg-pink-100', text: 'text-pink-600', icon: '👶' },
  ORDINATION: { label: 'ลาบวช', bg: 'bg-purple-100', text: 'text-purple-600', icon: '🧘' },
  OTHER: { label: 'อื่นๆ', bg: 'bg-slate-100', text: 'text-slate-600', icon: '📝' },
};

/**
 * สีและข้อความของสถานะการลา
 */
const leaveStatusConfig: Record<LeaveStatus, { label: string; bg: string; text: string }> = {
  PENDING: { label: 'รอพิจารณา', bg: 'bg-amber-100', text: 'text-amber-700' },
  APPROVED: { label: 'อนุมัติแล้ว', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  REJECTED: { label: 'ไม่อนุมัติ', bg: 'bg-rose-100', text: 'text-rose-700' },
};

/**
 * ข้อมูลสถิติรายบุคคล
 */
interface UserLeaveStats {
  user: User;
  stats: {
    totalLeaves: number;
    sickDays: number;
    personalDays: number;
    vacationDays: number;
    pending: number;
    approved: number;
    rejected: number;
    totalDays: number;
  };
}

/**
 * หน้าบันทึกการลา
 */
export default function LeavesPage() {
  const router = useRouter();
  
  // State สำหรับเก็บรายการลา
  const [leaves, setLeaves] = useState<Leave[]>([]);
  
  // State สำหรับเก็บรายชื่อผู้ใช้ (สำหรับเลือกผู้ขอลา)
  const [users, setUsers] = useState<User[]>([]);
  
  // State สำหรับเก็บสถิติรายบุคคล
  const [userStats, setUserStats] = useState<UserLeaveStats[]>([]);
  
  // State สำหรับสถานะการโหลด
  const [isLoading, setIsLoading] = useState(true);
  
  // State สำหรับข้อผิดพลาด
  const [error, setError] = useState<string | null>(null);
  
  // State สำหรับเปิด/ปิด Modal สร้างการลา
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State สำหรับเปิด/ปิด Modal Export
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  // State สำหรับแสดง/ซ่อน Dashboard
  const [showDashboard, setShowDashboard] = useState(false);
  
  // State สำหรับแสดง LeaveForm
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  
  // State สำหรับค้นหา
  const [searchType, setSearchType] = useState<'name' | 'date'>('name');
  const [searchName, setSearchName] = useState('');
  const [searchDate, setSearchDate] = useState('');
  
  // State สำหรับ Export
  const [exportName, setExportName] = useState('');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  // State สำหรับข้อมูลการลาใหม่
  const [newLeave, setNewLeave] = useState({
    userId: '',
    type: 'SICK' as LeaveType,
    startDate: '',
    endDate: '',
    reason: '',
  });
  // โหมดการลา: fullday / halfday / hours
  const [leaveMode, setLeaveMode] = useState<'fullday' | 'halfday' | 'hours'>('fullday');
  const [halfDayPeriod, setHalfDayPeriod] = useState<'MORNING' | 'AFTERNOON'>('MORNING');
  const [leaveHours, setLeaveHours] = useState<number>(1);

  // State สำหรับวันหยุด
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isHolidayPanelOpen, setIsHolidayPanelOpen] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ startDate: '', endDate: '', name: '' });
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [canManage, setCanManage] = useState(false);

  /**
   * ดึงข้อมูลการลาและผู้ใช้จาก API
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        // ดึงข้อมูลการลา
        const leavesResponse = await fetch('/api/leaves');
        const leavesData = await leavesResponse.json();
        
        if (!leavesResponse.ok) {
          throw new Error(leavesData.message || 'ไม่สามารถดึงข้อมูลการลาได้');
        }
        
        if (leavesData.success) {
          setLeaves(leavesData.data);
        }
        
        // ดึงข้อมูลผู้ใช้ (สำหรับเลือกผู้ขอลา)
        const usersResponse = await fetch('/api/users');
        const usersData = await usersResponse.json();
        
        if (usersResponse.ok && usersData.success) {
          setUsers(usersData.data);
        }

        // ดึงข้อมูลวันหยุด
        try {
          const holidaysResponse = await fetch(`/api/holidays?year=${new Date().getFullYear()}`);
          const holidaysData = await holidaysResponse.json();
          if (holidaysData.success) {
            setHolidays(holidaysData.data);
          }
        } catch {}

        // ตรวจสอบสิทธิ์ admin
        try {
          const sessionRes = await fetch('/api/auth/session');
          const sessionData = await sessionRes.json();
          if (sessionData.success && ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(sessionData.data.user.role)) {
            setCanManage(true);
          }
        } catch {}
      } catch (err) {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  /**
   * ดึงข้อมูลสถิติรายบุคคล
   */
  const fetchDashboard = async () => {
    try {
      const response = await fetch('/api/leaves/dashboard');
      const data = await response.json();
      
      if (data.success) {
        setUserStats(data.data.users);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    }
  };

  /**
   * สลับการแสดง Dashboard
   */
  const toggleDashboard = () => {
    if (!showDashboard) {
      fetchDashboard();
    }
    setShowDashboard(!showDashboard);
  };

  /**
   * ค้นหาการลา
   */
  const handleSearch = async () => {
    try {
      setIsLoading(true);
      
      let url = '/api/leaves/search?';
      if (searchType === 'name' && searchName) {
        url += `name=${encodeURIComponent(searchName)}`;
      } else if (searchType === 'date' && searchDate) {
        url += `date=${searchDate}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setLeaves(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * รีเซ็ตการค้นหา
   */
  const resetSearch = async () => {
    setSearchName('');
    setSearchDate('');
    
    try {
      const response = await fetch('/api/leaves');
      const data = await response.json();
      
      if (data.success) {
        setLeaves(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  };

  /**
   * Export ข้อมูลการลา
   */
  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      let url = '/api/leaves/export?';
      const params: string[] = [];
      
      if (exportName) {
        params.push(`name=${encodeURIComponent(exportName)}`);
      }
      if (exportStartDate) {
        params.push(`startDate=${exportStartDate}`);
      }
      if (exportEndDate) {
        params.push(`endDate=${exportEndDate}`);
      }
      
      url += params.join('&');
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'ไม่สามารถ export ข้อมูลได้');
      }
      
      // ดาวน์โหลดไฟล์
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `leaves_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      setIsExportModalOpen(false);
      setExportName('');
      setExportStartDate('');
      setExportEndDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * ฟังก์ชันสร้างรายการลาใหม่
   */
  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newLeave.userId || !newLeave.startDate || !newLeave.reason.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    // ถ้าลาเต็มวัน ต้องมี endDate
    if (leaveMode === 'fullday' && !newLeave.endDate) {
      setError('กรุณาระบุวันที่สิ้นสุด');
      return;
    }
    
    try {
      const payload: Record<string, any> = {
        ...newLeave,
        userId: parseInt(newLeave.userId),
        isHalfDay: leaveMode === 'halfday',
        hours: leaveMode === 'hours' ? leaveHours : undefined,
      };
      // ถ้าลาครึ่งวันหรือลาเป็นชม. ให้ endDate = startDate
      if (leaveMode === 'halfday' || leaveMode === 'hours') {
        payload.endDate = newLeave.startDate;
      }
      // เพิ่มข้อมูลช่วงครึ่งวันในเหตุผล
      if (leaveMode === 'halfday') {
        const periodLabel = halfDayPeriod === 'MORNING' ? 'ครึ่งวันเช้า' : 'ครึ่งวันบ่าย';
        payload.reason = `[${periodLabel}] ${newLeave.reason}`;
      }
      if (leaveMode === 'hours') {
        payload.reason = `[ลา ${leaveHours} ชม.] ${newLeave.reason}`;
      }

      const response = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'ไม่สามารถบันทึกการลาได้');
      }
      
      if (data.success) {
        setLeaves([data.data, ...leaves]);
        setIsModalOpen(false);
        setNewLeave({
          userId: '',
          type: 'SICK',
          startDate: '',
          endDate: '',
          reason: '',
        });
        setLeaveMode('fullday');
        setHalfDayPeriod('MORNING');
        setLeaveHours(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  };

  /**
   * ฟังก์ชันอนุมัติ/ไม่อนุมัติการลา
   */
  const handleUpdateStatus = async (leaveId: number, status: LeaveStatus) => {
    try {
      const response = await fetch(`/api/leaves/${leaveId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'ไม่สามารถอัปเดตสถานะได้');
      }
      
      if (data.success) {
        setLeaves(leaves.map(l => l.id === leaveId ? data.data : l));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  };

  /**
   * ฟังก์ชันลบรายการลา
   */
  const handleDeleteLeave = async (leaveId: number) => {
    if (!confirm('ต้องการลบรายการลานี้ใช่หรือไม่?')) return;
    
    try {
      const response = await fetch(`/api/leaves/${leaveId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'ไม่สามารถลบรายการลาได้');
      }
      
      setLeaves(leaves.filter(l => l.id !== leaveId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  };

  /**
   * ฟังก์ชันคำนวณจำนวนวันทำการ (ไม่นับ ส.-อา. และวันหยุด)
   */
  const calculateDays = (startDate: string | Date, endDate: string | Date): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateStr = current.toISOString().split('T')[0];
        const isHoliday = holidays.some(h => {
          const hDate = new Date(h.date).toISOString().split('T')[0];
          return hDate === dateStr;
        });
        if (!isHoliday) {
          count++;
        }
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  /**
   * เพิ่มวันหยุด
   */
  const handleAddHoliday = async () => {
    if (!newHoliday.startDate || !newHoliday.name.trim()) return;
    try {
      const response = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: newHoliday.startDate,
          endDate: newHoliday.endDate || newHoliday.startDate,
          name: newHoliday.name,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      if (data.success) {
        const created = Array.isArray(data.data) ? data.data : [data.data];
        setHolidays([...holidays, ...created].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setNewHoliday({ startDate: '', endDate: '', name: '' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  };

  /**
   * ลบวันหยุด
   */
  const handleDeleteHoliday = async (id: number) => {
    if (!confirm('ต้องการลบวันหยุดนี้ใช่หรือไม่?')) return;
    try {
      const response = await fetch(`/api/holidays?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message);
      }
      setHolidays(holidays.filter(h => h.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  };

  /**
   * โหลดวันหยุดตามปี
   */
  const fetchHolidaysByYear = async (year: number) => {
    try {
      const response = await fetch(`/api/holidays?year=${year}`);
      const data = await response.json();
      if (data.success) {
        setHolidays(data.data);
      }
    } catch {}
  };

  // แสดง loading ขณะโหลดข้อมูล
  if (isLoading && leaves.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* หัวข้อหน้า */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">บันทึกการลา</h1>
          <p className="text-slate-500 mt-1">
            จัดการและบันทึกประวัติการลาของพนักงาน
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canManage && (
            <button
              onClick={() => setIsHolidayPanelOpen(!isHolidayPanelOpen)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                isHolidayPanelOpen
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              <Calendar size={18} />
              <span>วันหยุด</span>
            </button>
          )}
          <button
            onClick={toggleDashboard}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
              showDashboard 
                ? "bg-indigo-100 text-indigo-700" 
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            <BarChart3 size={18} />
            <span>สถิติรายบุคคล</span>
            {showDashboard ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className={cn(
              "flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg",
              "hover:bg-emerald-200 transition-colors"
            )}
          >
            <Download size={18} />
            <span>Export</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className={cn(
              "flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg",
              "hover:bg-indigo-700 transition-colors shadow-sm"
            )}
          >
            <Plus size={18} />
            <span>บันทึกการลาใหม่</span>
          </button>
        </div>
      </div>

      {/* แสดงข้อผิดพลาด */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500" />
          <p className="text-rose-600">{error}</p>
        </div>
      )}

      {/* Holiday Management Panel */}
      {isHolidayPanelOpen && canManage && (
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Calendar size={18} className="text-amber-600" />
              จัดการวันหยุดของหน่วยงาน
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { const y = holidayYear - 1; setHolidayYear(y); fetchHolidaysByYear(y); }}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              >
                <ChevronDown size={16} className="rotate-90" />
              </button>
              <span className="text-sm font-medium text-slate-700 min-w-[60px] text-center">
                ปี {holidayYear + 543}
              </span>
              <button
                onClick={() => { const y = holidayYear + 1; setHolidayYear(y); fetchHolidaysByYear(y); }}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              >
                <ChevronUp size={16} className="rotate-90" />
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-3">
            วันลาจะไม่นับวันเสาร์-อาทิตย์ และวันหยุดที่กำหนดไว้ด้านล่าง
          </p>

          {/* Holiday List */}
          <div className="space-y-1.5 mb-4 max-h-52 overflow-y-auto">
            {holidays.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">ยังไม่มีวันหยุดสำหรับปีนี้</p>
            ) : (
              holidays.map((holiday) => (
                <div key={holiday.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 group">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {new Date(holiday.date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{holiday.name}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteHoliday(holiday.id)}
                    className="text-slate-300 hover:text-rose-500 p-1 rounded hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add new holiday */}
          <div className="space-y-2">
            <div className="flex gap-2 items-end flex-wrap">
              <div className="flex-shrink-0">
                <label className="block text-xs font-medium text-slate-500 mb-1">วันที่เริ่มต้น</label>
                <input
                  type="date"
                  value={newHoliday.startDate}
                  onChange={(e) => setNewHoliday({ ...newHoliday, startDate: e.target.value, endDate: newHoliday.endDate || e.target.value })}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex-shrink-0">
                <label className="block text-xs font-medium text-slate-500 mb-1">ถึงวันที่</label>
                <input
                  type="date"
                  value={newHoliday.endDate}
                  min={newHoliday.startDate}
                  onChange={(e) => setNewHoliday({ ...newHoliday, endDate: e.target.value })}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-medium text-slate-500 mb-1">ชื่อวันหยุด</label>
                <input
                  type="text"
                  placeholder="เช่น วันสงกรานต์"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddHoliday()}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <button
                onClick={handleAddHoliday}
                disabled={!newHoliday.startDate || !newHoliday.name.trim()}
                className={cn(
                  "bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors flex items-center gap-1",
                  (!newHoliday.startDate || !newHoliday.name.trim()) && "opacity-50 cursor-not-allowed"
                )}
              >
                <Plus size={16} />
                เพิ่ม
              </button>
            </div>
            {newHoliday.startDate && newHoliday.endDate && newHoliday.startDate !== newHoliday.endDate && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                จะเพิ่มวันหยุดติดกัน {Math.ceil((new Date(newHoliday.endDate).getTime() - new Date(newHoliday.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} วัน ({new Date(newHoliday.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - {new Date(newHoliday.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})
              </p>
            )}
          </div>
        </div>
      )}

      {/* ส่วนค้นหา */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* เลือกประเภทการค้นหา */}
          <div className="flex gap-2">
            <button
              onClick={() => setSearchType('name')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                searchType === 'name'
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              ค้นหาด้วยชื่อ
            </button>
            <button
              onClick={() => setSearchType('date')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                searchType === 'date'
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              ค้นหาด้วยวันที่
            </button>
          </div>

          {/* ช่องค้นหา */}
          <div className="flex-1 flex gap-2">
            {searchType === 'name' ? (
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="พิมพ์ชื่อพนักงาน..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            ) : (
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            )}
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              ค้นหา
            </button>
            <button
              onClick={resetSearch}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            >
              รีเซ็ต
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard สถิติรายบุคคล */}
      {showDashboard && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            สถิติการลารายบุคคล (ปี {new Date().getFullYear()})
          </h2>
          
          {userStats.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p>กำลังโหลดข้อมูล...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 text-sm font-semibold text-slate-600">พนักงาน</th>
                    <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-center">ลาป่วย</th>
                    <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-center">ลากิจ</th>
                    <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-center">ลาพักร้อน</th>
                    <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-center">รวม (วัน)</th>
                    <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userStats.map((item) => (
                    <tr key={item.user.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                            {item.user.avatar || item.user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-700">{item.user.name}</p>
                            <p className="text-xs text-slate-400">{item.user.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-rose-600 font-medium">{item.stats.sickDays}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-amber-600 font-medium">{item.stats.personalDays}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-blue-600 font-medium">{item.stats.vacationDays}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-700">{item.stats.totalDays}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center gap-1 text-xs">
                          {item.stats.pending > 0 && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                              รอ {item.stats.pending}
                            </span>
                          )}
                          {item.stats.approved > 0 && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                              อนุมัติ {item.stats.approved}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      

      {/* รายการลา */}
      <div className="space-y-4">
        {leaves.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">ไม่มีข้อมูลการลา</p>
          </div>
        ) : (
          leaves.map((leave) => (
            <div
              key={leave.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* ข้อมูลการลา */}
                <div className="flex gap-4">
                  {/* ไอคอนประเภทการลา */}
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-xl",
                      leaveTypeConfig[leave.type].bg,
                      leaveTypeConfig[leave.type].text
                    )}
                  >
                    {leaveTypeConfig[leave.type].icon}
                  </div>
                  
                  {/* รายละเอียด */}
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-slate-800">{leave.user.name}</h3>
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-medium",
                          leaveStatusConfig[leave.status].bg,
                          leaveStatusConfig[leave.status].text
                        )}
                      >
                        {leaveStatusConfig[leave.status].label}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-slate-500">
                      <span className="font-medium text-slate-600">
                        {leaveTypeConfig[leave.type].label}
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>
                          {new Date(leave.startDate).toLocaleDateString('th-TH')} - {' '}
                          {new Date(leave.endDate).toLocaleDateString('th-TH')}
                        </span>
                        <span className="text-slate-400">
                          ({leave.isHalfDay
                            ? '0.5 วัน'
                            : leave.hours && leave.hours > 0
                              ? `${leave.hours <= 3 ? '0.5' : '1'} วัน`
                              : `${calculateDays(leave.startDate, leave.endDate)} วันทำการ`})
                        </span>
                      </div>
                      <span className="hidden sm:inline">•</span>
                      <span className="italic text-slate-400">"{leave.reason}"</span>
                    </div>
                  </div>
                </div>

                {/* ปุ่มดำเนินการ */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedLeave(leave);
                      setShowLeaveForm(true);
                    }}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="พิมพ์แบบฟอร์ม"
                  >
                    <FileSpreadsheet size={20} />
                  </button>
                  {leave.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(leave.id, 'REJECTED')}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="ไม่อนุมัติ"
                      >
                        <XCircle size={20} />
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(leave.id, 'APPROVED')}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="อนุมัติ"
                      >
                        <CheckCircle size={20} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDeleteLeave(leave.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors ml-2"
                    title="ลบ"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal บันทึกการลา */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800">บันทึกการลา</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateLeave} className="p-6 space-y-4">
              {/* เลือกพนักงาน */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  พนักงาน <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={newLeave.userId}
                  onChange={(e) => setNewLeave({ ...newLeave, userId: e.target.value })}
                >
                  <option value="">เลือกพนักงาน...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} {user.department && `(${user.department})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ประเภทการลา
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none"
                  value={newLeave.type}
                  onChange={(e) => setNewLeave({ ...newLeave, type: e.target.value as LeaveType })}
                >
                  <option value="SICK">ลาป่วย</option>
                  <option value="PERSONAL">ลากิจ</option>
                  <option value="VACATION">ลาพักร้อน</option>
                  <option value="MATERNITY">ลาคลอดบุตร</option>
                  <option value="ORDINATION">ลาบวช</option>
                  <option value="OTHER">อื่นๆ</option>
                </select>
              </div>

              {/* โหมดการลา */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  รูปแบบการลา
                </label>
                <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setLeaveMode('fullday')}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      leaveMode === 'fullday'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    เต็มวัน
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveMode('halfday')}
                    className={`flex-1 py-2 text-sm font-medium transition-colors border-x border-slate-300 ${
                      leaveMode === 'halfday'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ครึ่งวัน
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveMode('hours')}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      leaveMode === 'hours'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    รายชั่วโมง
                  </button>
                </div>
              </div>

              {/* ครึ่งวัน: เลือกเช้า/บ่าย */}
              {leaveMode === 'halfday' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ช่วงเวลา
                  </label>
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setHalfDayPeriod('MORNING')}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${
                        halfDayPeriod === 'MORNING'
                          ? 'bg-amber-500 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      ครึ่งวันเช้า (08:30 - 12:00)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHalfDayPeriod('AFTERNOON')}
                      className={`flex-1 py-2 text-sm font-medium transition-colors border-l border-slate-300 ${
                        halfDayPeriod === 'AFTERNOON'
                          ? 'bg-amber-500 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      ครึ่งวันบ่าย (13:00 - 16:30)
                    </button>
                  </div>
                </div>
              )}

              {/* รายชั่วโมง: เลือกจำนวนชม. */}
              {leaveMode === 'hours' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    จำนวนชั่วโมง
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={7}
                      step={1}
                      value={leaveHours}
                      onChange={(e) => setLeaveHours(Math.max(1, Math.min(7, parseInt(e.target.value) || 1)))}
                      className="w-24 border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                    />
                    <span className="text-sm text-slate-500">ชั่วโมง (1-7 ชม.)</span>
                  </div>
                </div>
              )}

              {/* วันที่ */}
              <div className={leaveMode === 'fullday' ? 'grid grid-cols-2 gap-4' : ''}>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {leaveMode === 'fullday' ? 'ตั้งแต่วันที่' : 'วันที่ลา'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newLeave.startDate}
                    onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
                  />
                </div>
                {leaveMode === 'fullday' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      ถึงวันที่ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newLeave.endDate}
                      onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  เหตุผล <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none resize-none"
                  placeholder="ระบุเหตุผล..."
                  value={newLeave.reason}
                  onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors"
              >
                บันทึกข้อมูล
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Export */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Export ข้อมูลการลา
              </h3>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* ค้นหาด้วยชื่อ */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ชื่อพนักงาน (ไม่บังคับ)
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={exportName}
                  onChange={(e) => setExportName(e.target.value)}
                >
                  <option value="">ทั้งหมด</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.name}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* ช่วงวันที่ */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ตั้งแต่วันที่
                  </label>
                  <input
                    type="date"
                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ถึงวันที่
                  </label>
                  <input
                    type="date"
                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">
                <p>ไฟล์จะถูกดาวน์โหลดในรูปแบบ CSV</p>
                <p className="text-xs mt-1">คอลัมน์: รหัส, ชื่อ, แผนก, ประเภท, วันที่, จำนวนวัน, เหตุผล, สถานะ</p>
              </div>

              <button
                onClick={handleExport}
                disabled={isExporting}
                className={cn(
                  "w-full bg-emerald-600 text-white py-2.5 rounded-lg hover:bg-emerald-700 font-medium transition-colors",
                  "flex items-center justify-center gap-2",
                  isExporting && "opacity-70 cursor-not-allowed"
                )}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>กำลัง Export...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>ดาวน์โหลด CSV</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LeaveForm Modal */}
      {showLeaveForm && selectedLeave && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 sticky top-0">
              <h3 className="font-bold text-slate-800">แบบใบลาป่วย ลาคลอดบุตร ลากิจ</h3>
              <button
                onClick={() => {
                  setShowLeaveForm(false);
                  setSelectedLeave(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <LeaveForm 
                leave={selectedLeave}
                holidays={holidays}
                previousLeave={
                  leaves
                    .filter(l => 
                      l.userId === selectedLeave.userId && 
                      l.id !== selectedLeave.id &&
                      new Date(l.createdAt) < new Date(selectedLeave.createdAt)
                    )
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null
                }
                userLeaves={leaves.filter(l => l.userId === selectedLeave.userId)}
                onClose={() => {
                  setShowLeaveForm(false);
                  setSelectedLeave(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
