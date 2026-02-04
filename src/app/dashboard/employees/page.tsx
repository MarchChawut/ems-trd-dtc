/**
 * ==================================================
 * Employees Page - หน้ารายชื่อพนักงาน
 * ==================================================
 * แสดงรายชื่อพนักงานทั้งหมดและจัดการข้อมูล
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Trash2, 
  Loader2,
  AlertCircle,
  Search,
  X,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { User, UserRole } from '@/types';

/**
 * สีและข้อความของบทบาท
 */
const roleConfig: Record<UserRole, { label: string; bg: string; text: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', bg: 'bg-purple-100', text: 'text-purple-700' },
  ADMIN: { label: 'Admin', bg: 'bg-indigo-100', text: 'text-indigo-700' },
  MANAGER: { label: 'Manager', bg: 'bg-blue-100', text: 'text-blue-700' },
  HR: { label: 'HR', bg: 'bg-pink-100', text: 'text-pink-700' },
  EMPLOYEE: { label: 'Employee', bg: 'bg-slate-100', text: 'text-slate-700' },
};

/**
 * หน้ารายชื่อพนักงาน
 */
export default function EmployeesPage() {
  const router = useRouter();
  
  // State สำหรับเก็บรายชื่อพนักงาน
  const [users, setUsers] = useState<User[]>([]);
  
  // State สำหรับสถานะการโหลด
  const [isLoading, setIsLoading] = useState(true);
  
  // State สำหรับข้อผิดพลาด
  const [error, setError] = useState<string | null>(null);
  
  // State สำหรับเปิด/ปิด Modal สร้างพนักงาน
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State สำหรับค้นหา
  const [searchQuery, setSearchQuery] = useState('');
  
  // State สำหรับข้อมูลพนักงานใหม่
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'EMPLOYEE' as UserRole,
    department: '',
  });

  /**
   * ดึงข้อมูลพนักงานจาก API
   */
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'ไม่สามารถดึงข้อมูลพนักงานได้');
        }
        
        if (data.success) {
          setUsers(data.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUsers();
  }, []);

  /**
   * ฟังก์ชันสร้างพนักงานใหม่
   */
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.username.trim() || !newUser.password.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'ไม่สามารถสร้างพนักงานได้');
      }
      
      if (data.success) {
        setUsers([...users, data.data]);
        setIsModalOpen(false);
        setNewUser({
          name: '',
          email: '',
          username: '',
          password: '',
          role: 'EMPLOYEE',
          department: '',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  };

  /**
   * ฟังก์ชันลบพนักงาน
   */
  const handleDeleteUser = async (userId: number) => {
    if (!confirm('ต้องการลบพนักงานรายนี้ใช่หรือไม่?')) return;
    
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'ไม่สามารถลบพนักงานได้');
      }
      
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  };

  /**
   * ฟังก์ชันกรองผู้ใช้ตามคำค้นหา
   */
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">รายชื่อพนักงาน</h1>
          <p className="text-slate-500 mt-1">
            สมาชิกทั้งหมด {users.length} คน
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
          <span>เพิ่มพนักงานใหม่</span>
        </button>
      </div>

      {/* แสดงข้อผิดพลาด */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500" />
          <p className="text-rose-600">{error}</p>
        </div>
      )}

      {/* ช่องค้นหา */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="ค้นหาพนักงาน..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
      </div>

      {/* ตารางพนักงาน */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-4 px-6 font-semibold text-sm text-slate-600">พนักงาน</th>
                <th className="py-4 px-6 font-semibold text-sm text-slate-600">ตำแหน่ง/แผนก</th>
                <th className="py-4 px-6 font-semibold text-sm text-slate-600">สถานะ</th>
                <th className="py-4 px-6 font-semibold text-sm text-slate-600 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p>ไม่พบข้อมูลพนักงาน</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 border border-indigo-200">
                          {user.avatar || user.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-medium text-slate-700 block">{user.name}</span>
                          <span className="text-xs text-slate-400">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={cn(
                          "inline-flex px-2 py-0.5 rounded text-xs font-medium",
                          roleConfig[user.role].bg,
                          roleConfig[user.role].text
                        )}
                      >
                        {roleConfig[user.role].label}
                      </span>
                      {user.department && (
                        <p className="text-xs text-slate-500 mt-1">{user.department}</p>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={cn(
                          "inline-flex px-2 py-0.5 rounded text-xs font-medium",
                          user.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-slate-400 hover:text-rose-500 transition-colors p-2 hover:bg-rose-50 rounded-lg"
                        title="ลบ"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal เพิ่มพนักงาน */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 sticky top-0">
              <h3 className="font-bold text-slate-800">เพิ่มพนักงานใหม่</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ชื่อ-นามสกุล <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="สมชาย ใจดี"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  อีเมล <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="email@example.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ชื่อผู้ใช้ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  รหัสผ่าน <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="รหัสผ่านอย่างน้อย 8 ตัวอักษร"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ตำแหน่ง
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="HR">HR</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  แผนก
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none"
                  value={newUser.department}
                  onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                >
                  <option value="">เลือกแผนก...</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Development">Development</option>
                  <option value="HR">HR</option>
                  <option value="Management">Management</option>
                  <option value="Sales">Sales</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors"
              >
                บันทึก
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
