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
import { Leave, LeaveType, LeaveStatus, User } from '@/types';

/**
 * สีและข้อความของประเภทการลา
 */
const leaveTypeConfig: Record<LeaveType, { label: string; bg: string; text: string; icon: string }> = {
  SICK: { label: 'ลาป่วย', bg: 'bg-rose-100', text: 'text-rose-600', icon: '🏥' },
  PERSONAL: { label: 'ลากิจ', bg: 'bg-amber-100', text: 'text-amber-600', icon: '💼' },
  VACATION: { label: 'ลาพักร้อน', bg: 'bg-blue-100', text: 'text-blue-600', icon: '🏖️' },
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
    
    if (!newLeave.userId || !newLeave.startDate || !newLeave.endDate || !newLeave.reason.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    
    try {
      const response = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newLeave,
          userId: parseInt(newLeave.userId),
        }),
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
   * ฟังก์ชันคำนวณจำนวนวัน
   */
  const calculateDays = (startDate: string | Date, endDate: string | Date): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
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
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            ) : (
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
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
                          ({calculateDays(leave.startDate, leave.endDate)} วัน)
                        </span>
                      </div>
                      <span className="hidden sm:inline">•</span>
                      <span className="italic text-slate-400">"{leave.reason}"</span>
                    </div>
                  </div>
                </div>

                {/* ปุ่มดำเนินการ */}
                <div className="flex items-center gap-2">
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
                  <option value="OTHER">อื่นๆ</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ตั้งแต่วันที่ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none"
                    value={newLeave.startDate}
                    onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ถึงวันที่ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none"
                    value={newLeave.endDate}
                    onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                  />
                </div>
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
    </div>
  );
}
