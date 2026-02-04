/**
 * ==================================================
 * Leaves Page - หน้าบันทึกการลา
 * ==================================================
 * แสดงรายการลาทั้งหมดและจัดการการอนุมัติ
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
  X
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
 * หน้าบันทึกการลา
 */
export default function LeavesPage() {
  const router = useRouter();
  
  // State สำหรับเก็บรายการลา
  const [leaves, setLeaves] = useState<Leave[]>([]);
  
  // State สำหรับสถานะการโหลด
  const [isLoading, setIsLoading] = useState(true);
  
  // State สำหรับข้อผิดพลาด
  const [error, setError] = useState<string | null>(null);
  
  // State สำหรับเปิด/ปิด Modal สร้างการลา
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State สำหรับข้อมูลการลาใหม่
  const [newLeave, setNewLeave] = useState({
    type: 'SICK' as LeaveType,
    startDate: '',
    endDate: '',
    reason: '',
  });

  /**
   * ดึงข้อมูลการลาจาก API
   */
  useEffect(() => {
    const fetchLeaves = async () => {
      try {
        const response = await fetch('/api/leaves');
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'ไม่สามารถดึงข้อมูลการลาได้');
        }
        
        if (data.success) {
          setLeaves(data.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLeaves();
  }, []);

  /**
   * ฟังก์ชันสร้างรายการลาใหม่
   */
  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newLeave.startDate || !newLeave.endDate || !newLeave.reason.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    
    try {
      const response = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLeave),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'ไม่สามารถบันทึกการลาได้');
      }
      
      if (data.success) {
        setLeaves([data.data, ...leaves]);
        setIsModalOpen(false);
        setNewLeave({
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
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* หัวข้อหน้า */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">บันทึกการลา</h1>
          <p className="text-slate-500 mt-1">
            จัดการและบันทึกประวัติการลาของพนักงาน
          </p>
        </div>
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

      {/* แสดงข้อผิดพลาด */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500" />
          <p className="text-rose-600">{error}</p>
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
    </div>
  );
}
