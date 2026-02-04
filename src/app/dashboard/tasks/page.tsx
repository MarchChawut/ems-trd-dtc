/**
 * ==================================================
 * Tasks Page - หน้าจัดการงาน (Kanban Board)
 * ==================================================
 * แสดงงานในรูปแบบ Kanban Board พร้อมฟังก์ชัน:
 * - Drag & Drop
 * - จัดการ Column (เพิ่ม/ลบ/แก้ไข)
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Trash2, 
  Loader2,
  AlertCircle,
  X,
  Settings,
  MoreVertical,
  GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task, TaskPriority, User } from '@/types';

/**
 * ข้อมูลคอลัมน์
 */
interface Column {
  id: number;
  name: string;
  color: string;
  order: number;
  isDefault: boolean;
}

/**
 * สีของ priority
 */
const priorityColors: Record<TaskPriority, { bg: string; text: string; label: string }> = {
  LOW: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'ต่ำ' },
  MEDIUM: { bg: 'bg-amber-100', text: 'text-amber-600', label: 'ปานกลาง' },
  HIGH: { bg: 'bg-rose-100', text: 'text-rose-600', label: 'สูง' },
  URGENT: { bg: 'bg-purple-100', text: 'text-purple-600', label: 'เร่งด่วน' },
};

/**
 * สีของคอลัมน์
 */
const columnColors: Record<string, { border: string; bg: string }> = {
  slate: { border: 'border-slate-300', bg: 'bg-slate-50' },
  blue: { border: 'border-blue-300', bg: 'bg-blue-50' },
  emerald: { border: 'border-emerald-300', bg: 'bg-emerald-50' },
  amber: { border: 'border-amber-300', bg: 'bg-amber-50' },
  rose: { border: 'border-rose-300', bg: 'bg-rose-50' },
  purple: { border: 'border-purple-300', bg: 'bg-purple-50' },
};

/**
 * หน้าจัดการงาน (Kanban Board)
 */
export default function TasksPage() {
  const router = useRouter();
  
  // State สำหรับเก็บรายการงาน
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // State สำหรับเก็บคอลัมน์
  const [columns, setColumns] = useState<Column[]>([]);
  
  // State สำหรับเก็บรายชื่อผู้ใช้
  const [users, setUsers] = useState<User[]>([]);
  
  // State สำหรับสถานะการโหลด
  const [isLoading, setIsLoading] = useState(true);
  
  // State สำหรับข้อผิดพลาด
  const [error, setError] = useState<string | null>(null);
  
  // State สำหรับเปิด/ปิด Modal สร้างงาน
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  // State สำหรับเปิด/ปิด Modal จัดการคอลัมน์
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  
  // State สำหรับข้อมูลงานใหม่
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM' as TaskPriority,
    columnId: '',
    assigneeId: '',
  });
  
  // State สำหรับข้อมูลคอลัมน์ใหม่
  const [newColumn, setNewColumn] = useState({
    name: '',
    color: 'slate',
  });
  
  // State สำหรับงานที่กำลังลาก
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  
  // State สำหรับ role ของผู้ใช้ปัจจุบัน
  const [userRole, setUserRole] = useState<string>('');

  /**
   * ดึงข้อมูลจาก API
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        // ดึงข้อมูล session เพื่อตรวจสอบ role
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        if (sessionData.success) {
          setUserRole(sessionData.data.user.role);
        }

        // ดึงข้อมูลคอลัมน์
        const columnsResponse = await fetch('/api/columns');
        const columnsData = await columnsResponse.json();
        
        if (columnsResponse.ok && columnsData.success) {
          setColumns(columnsData.data);
        }

        // ดึงข้อมูลงาน
        const tasksResponse = await fetch('/api/tasks');
        const tasksData = await tasksResponse.json();
        
        if (tasksResponse.ok && tasksData.success) {
          setTasks(tasksData.data);
        }
        
        // ดึงข้อมูลผู้ใช้
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
   * ฟังก์ชันเริ่มลากงาน
   */
  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  /**
   * ฟังก์ชันอนุญาตให้วาง
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  /**
   * ฟังก์ชันวางงานในคอลัมน์ใหม่
   */
  const handleDrop = async (e: React.DragEvent, columnId: number) => {
    e.preventDefault();
    
    if (!draggedTask || draggedTask.columnId === columnId) return;
    
    // อัปเดต UI ทันที (Optimistic Update)
    const updatedTasks = tasks.map(t =>
      t.id === draggedTask.id ? { ...t, columnId } : t
    );
    setTasks(updatedTasks);
    
    try {
      // ส่งข้อมูลไปยัง API
      const response = await fetch(`/api/tasks/${draggedTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnId }),
      });
      
      if (!response.ok) {
        // ถ้าไม่สำเร็จ ให้คืนค่าเดิม
        setTasks(tasks);
        const data = await response.json();
        throw new Error(data.message || 'ไม่สามารถอัปเดตสถานะได้');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setDraggedTask(null);
    }
  };

  /**
   * ฟังก์ชันสร้างงานใหม่
   */
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTask.title.trim()) return;
    
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTask,
          columnId: newTask.columnId ? parseInt(newTask.columnId) : columns[0]?.id,
          assigneeId: newTask.assigneeId ? parseInt(newTask.assigneeId) : undefined,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'ไม่สามารถสร้างงานได้');
      }
      
      if (data.success) {
        setTasks([...tasks, data.data]);
        setIsTaskModalOpen(false);
        setNewTask({
          title: '',
          description: '',
          priority: 'MEDIUM',
          columnId: '',
          assigneeId: '',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  };

  /**
   * ฟังก์ชันสร้างคอลัมน์ใหม่
   */
  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newColumn.name.trim()) return;
    
    try {
      const response = await fetch('/api/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newColumn),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'ไม่สามารถสร้างคอลัมน์ได้');
      }
      
      if (data.success) {
        setColumns([...columns, data.data]);
        setNewColumn({ name: '', color: 'slate' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  };

  /**
   * ฟังก์ชันลบคอลัมน์
   */
  const handleDeleteColumn = async (columnId: number) => {
    const column = columns.find(c => c.id === columnId);
    if (column?.isDefault) {
      alert('ไม่สามารถลบคอลัมน์เริ่มต้นได้');
      return;
    }
    
    // ตรวจสอบว่ามีงานในคอลัมน์หรือไม่
    const tasksInColumn = tasks.filter(t => t.columnId === columnId);
    if (tasksInColumn.length > 0) {
      alert(`ไม่สามารถลบคอลัมน์นี้ได้ เนื่องจากมีงาน ${tasksInColumn.length} รายการอยู่ในคอลัมน์`);
      return;
    }
    
    if (!confirm('ต้องการลบคอลัมน์นี้ใช่หรือไม่?')) return;
    
    try {
      const response = await fetch(`/api/columns/${columnId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'ไม่สามารถลบคอลัมน์ได้');
      }
      
      setColumns(columns.filter(c => c.id !== columnId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  };

  /**
   * ฟังก์ชันลบงาน
   */
  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('ต้องการลบงานนี้ใช่หรือไม่?')) return;
    
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'ไม่สามารถลบงานได้');
      }
      
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  };

  // ตรวจสอบสิทธิ์จัดการคอลัมน์
  const canManageColumns = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(userRole);

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
          <h1 className="text-2xl font-bold text-slate-800">จัดการโปรเจค (Kanban)</h1>
          <p className="text-slate-500 mt-1">
            ลากและวางงานเพื่อเปลี่ยนสถานะ
          </p>
        </div>
        <div className="flex gap-2">
          {canManageColumns && (
            <button
              onClick={() => setIsColumnModalOpen(true)}
              className={cn(
                "flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg",
                "hover:bg-slate-200 transition-colors"
              )}
            >
              <Settings size={18} />
              <span>จัดการคอลัมน์</span>
            </button>
          )}
          <button
            onClick={() => setIsTaskModalOpen(true)}
            className={cn(
              "flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg",
              "hover:bg-indigo-700 transition-colors shadow-sm"
            )}
          >
            <Plus size={18} />
            <span>เพิ่มงานใหม่</span>
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

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max">
          {columns.sort((a, b) => a.order - b.order).map((column) => {
            const colors = columnColors[column.color] || columnColors.slate;
            const columnTasks = tasks.filter(t => t.columnId === column.id);
            
            return (
              <div
                key={column.id}
                className={cn(
                  "w-80 rounded-xl p-4 border-2 min-h-[400px]",
                  colors.bg,
                  colors.border
                )}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {/* หัวข้อคอลัมน์ */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-700">{column.name}</h3>
                  <span className="bg-white px-2 py-1 rounded text-xs font-semibold text-slate-600 shadow-sm">
                    {columnTasks.length}
                  </span>
                </div>

                {/* รายการงาน */}
                <div className="space-y-3">
                  {columnTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      className={cn(
                        "bg-white p-4 rounded-lg shadow-sm border border-slate-200",
                        "cursor-move hover:shadow-md transition-all group relative"
                      )}
                    >
                      {/* ปุ่มลบ */}
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>

                      {/* Priority Badge */}
                      <div className="mb-2">
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider",
                            priorityColors[task.priority].bg,
                            priorityColors[task.priority].text
                          )}
                        >
                          {priorityColors[task.priority].label}
                        </span>
                      </div>

                      {/* ชื่องาน */}
                      <p className="font-medium text-slate-800 mb-3 pr-4">
                        {task.title}
                      </p>

                      {/* ผู้รับผิดชอบ */}
                      {task.assignee && (
                        <div className="flex items-center gap-2 mt-auto">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 border border-indigo-200">
                            {task.assignee.avatar || task.assignee.name.charAt(0)}
                          </div>
                          <span className="text-xs text-slate-500">
                            {task.assignee.name}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal สร้างงานใหม่ */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800">เพิ่มงานใหม่</h3>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ชื่องาน <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="ระบุสิ่งที่ต้องทำ..."
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  รายละเอียด
                </label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none resize-none"
                  placeholder="รายละเอียดเพิ่มเติม..."
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  คอลัมน์
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none"
                  value={newTask.columnId}
                  onChange={(e) => setNewTask({ ...newTask, columnId: e.target.value })}
                >
                  <option value="">เลือกคอลัมน์...</option>
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ความสำคัญ
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none"
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as TaskPriority })}
                >
                  <option value="LOW">ต่ำ</option>
                  <option value="MEDIUM">ปานกลาง</option>
                  <option value="HIGH">สูง</option>
                  <option value="URGENT">เร่งด่วน</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ผู้รับผิดชอบ
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none"
                  value={newTask.assigneeId}
                  onChange={(e) => setNewTask({ ...newTask, assigneeId: e.target.value })}
                >
                  <option value="">เลือกพนักงาน...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 font-medium transition-colors"
              >
                บันทึกงาน
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal จัดการคอลัมน์ */}
      {isColumnModalOpen && canManageColumns && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800">จัดการคอลัมน์</h3>
              <button
                onClick={() => setIsColumnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* รายการคอลัมน์ปัจจุบัน */}
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-3">คอลัมน์ปัจจุบัน</h4>
                <div className="space-y-2">
                  {columns.sort((a, b) => a.order - b.order).map((column) => (
                    <div
                      key={column.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-slate-400" />
                        <div
                          className={cn(
                            "w-4 h-4 rounded",
                            columnColors[column.color]?.bg || 'bg-slate-200'
                          )}
                        />
                        <span className="font-medium text-slate-700">{column.name}</span>
                        {column.isDefault && (
                          <span className="text-xs text-slate-400">(ค่าเริ่มต้น)</span>
                        )}
                      </div>
                      {!column.isDefault && (
                        <button
                          onClick={() => handleDeleteColumn(column.id)}
                          className="text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ฟอร์มเพิ่มคอลัมน์ใหม่ */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-medium text-slate-700 mb-3">เพิ่มคอลัมน์ใหม่</h4>
                <form onSubmit={handleCreateColumn} className="space-y-3">
                  <div>
                    <input
                      type="text"
                      placeholder="ชื่อคอลัมน์"
                      value={newColumn.name}
                      onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-2">สี</label>
                    <div className="flex gap-2">
                      {Object.entries(columnColors).map(([color, styles]) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewColumn({ ...newColumn, color })}
                          className={cn(
                            "w-8 h-8 rounded-lg border-2 transition-all",
                            styles.bg,
                            newColumn.color === color ? 'border-slate-800' : 'border-transparent'
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    เพิ่มคอลัมน์
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
