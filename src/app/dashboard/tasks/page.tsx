/**
 * ==================================================
 * Tasks Page - หน้าจัดการงาน (Kanban Board)
 * ==================================================
 * แสดงงานในรูปแบบ Kanban Board พร้อมฟังก์ชัน Drag & Drop
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Trash2, 
  Loader2,
  AlertCircle,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task, TaskStatus, TaskPriority, User } from '@/types';

/**
 * คอลัมน์ใน Kanban Board
 */
const columns: { id: TaskStatus; title: string; color: string; bgColor: string }[] = [
  { id: 'TODO', title: 'รอดำเนินการ', color: 'border-slate-300', bgColor: 'bg-slate-50' },
  { id: 'IN_PROGRESS', title: 'กำลังทำ', color: 'border-blue-300', bgColor: 'bg-blue-50' },
  { id: 'DONE', title: 'เสร็จสิ้น', color: 'border-emerald-300', bgColor: 'bg-emerald-50' },
];

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
 * หน้าจัดการงาน (Kanban Board)
 */
export default function TasksPage() {
  const router = useRouter();
  
  // State สำหรับเก็บรายการงาน
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // State สำหรับเก็บรายชื่อผู้ใช้ (สำหรับมอบหมายงาน)
  const [users, setUsers] = useState<User[]>([]);
  
  // State สำหรับสถานะการโหลด
  const [isLoading, setIsLoading] = useState(true);
  
  // State สำหรับข้อผิดพลาด
  const [error, setError] = useState<string | null>(null);
  
  // State สำหรับเปิด/ปิด Modal สร้างงาน
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State สำหรับข้อมูลงานใหม่
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM' as TaskPriority,
    assigneeId: '',
  });
  
  // State สำหรับงานที่กำลังลาก
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  /**
   * ดึงข้อมูลงานและผู้ใช้จาก API
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        // ดึงข้อมูลงาน
        const tasksResponse = await fetch('/api/tasks');
        const tasksData = await tasksResponse.json();
        
        if (!tasksResponse.ok) {
          throw new Error(tasksData.message || 'ไม่สามารถดึงข้อมูลงานได้');
        }
        
        if (tasksData.success) {
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
  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    
    if (!draggedTask || draggedTask.status === status) return;
    
    // อัปเดต UI ทันที (Optimistic Update)
    const updatedTasks = tasks.map(t =>
      t.id === draggedTask.id ? { ...t, status } : t
    );
    setTasks(updatedTasks);
    
    try {
      // ส่งข้อมูลไปยัง API
      const response = await fetch(`/api/tasks/${draggedTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
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
          assigneeId: newTask.assigneeId ? parseInt(newTask.assigneeId) : undefined,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'ไม่สามารถสร้างงานได้');
      }
      
      if (data.success) {
        setTasks([...tasks, data.data]);
        setIsModalOpen(false);
        setNewTask({
          title: '',
          description: '',
          priority: 'MEDIUM',
          assigneeId: '',
        });
      }
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
        <button
          onClick={() => setIsModalOpen(true)}
          className={cn(
            "flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg",
            "hover:bg-indigo-700 transition-colors shadow-sm"
          )}
        >
          <Plus size={18} />
          <span>เพิ่มงานใหม่</span>
        </button>
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
        <div className="flex gap-6 min-w-[900px]">
          {columns.map((column) => (
            <div
              key={column.id}
              className={cn(
                "flex-1 rounded-xl p-4 border-2 min-h-[400px]",
                column.bgColor,
                column.color
              )}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* หัวข้อคอลัมน์ */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-700">{column.title}</h3>
                <span className="bg-white px-2 py-1 rounded text-xs font-semibold text-slate-600 shadow-sm">
                  {tasks.filter(t => t.status === column.id).length}
                </span>
              </div>

              {/* รายการงาน */}
              <div className="space-y-3">
                {tasks
                  .filter((task) => task.status === column.id)
                  .map((task) => (
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
          ))}
        </div>
      </div>

      {/* Modal สร้างงานใหม่ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800">เพิ่มงานใหม่</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
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
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                  placeholder="รายละเอียดเพิ่มเติม..."
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                />
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
    </div>
  );
}
