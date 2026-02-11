/**
 * ==================================================
 * TypeScript Types - ประเภทข้อมูลทั้งหมดของแอปพลิเคชัน
 * ==================================================
 * ไฟล์นี้กำหนด TypeScript interfaces และ types ที่ใช้ทั่วแอปพลิเคชัน
 */

// ============================================
// User Types - ประเภทข้อมูลผู้ใช้
// ============================================

/**
 * บทบาทของผู้ใช้ในระบบ
 */
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'HR';

/**
 * ข้อมูลผู้ใช้พื้นฐาน (ไม่รวมรหัสผ่าน)
 * ใช้สำหรับส่งข้อมูลผู้ใช้ไปยัง client
 */
export interface User {
  id: number;
  email: string;
  username: string;
  prefix: string | null; // คำนำหน้า เช่น นาย, น.ส., ร.ต.
  name: string;
  role: UserRole;
  department: string | null; // กอง เช่น กองการศึกษา วิจัย และพัฒนา
  division: string | null; // สังกัด เช่น ศูนย์เทคโนโลยีดิจิทัล สำนักพระราชวัง
  position: string | null; // ตำแหน่ง เช่น จนท.ฝ่ายธุรการ
  positionSecond: string | null; // ตำแหน่งรอง เช่น เจ้าหน้าที่งานในพระองค์
  positionLevel: number | null; // ระดับ 1-11
  avatar: string | null;
  profileImage: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ข้อมูลแผนก/กอง
 */
export interface Department {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  order: number;
}

/**
 * ข้อมูลตำแหน่ง
 */
export interface Position {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  order: number;
}

/**
 * ข้อมูลตำแหน่งรอง
 */
export interface PositionSecond {
  id: number;
  name: string;
  description: string | null;
  hasLevel: boolean;
  maxLevel: number | null;
  isActive: boolean;
  order: number;
}

/**
 * ข้อมูลผู้ใช้ที่ใช้ใน session
 */
export interface SessionUser {
  id: number;
  email: string;
  username: string;
  name: string;
  role: UserRole;
  avatar: string | null;
}

/**
 * ข้อมูลสำหรับสร้างผู้ใช้ใหม่
 */
export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  department?: string;
  division?: string;
  position?: string;
  positionSecond?: string;
  positionLevel?: number;
}

/**
 * ข้อมูลสำหรับอัปเดตผู้ใช้
 */
export interface UpdateUserInput {
  email?: string;
  prefix?: string | null;
  name?: string;
  role?: UserRole;
  department?: string;
  division?: string;
  position?: string;
  positionSecond?: string;
  positionLevel?: number;
  profileImage?: string | null;
  isActive?: boolean;
}

// ============================================
// Task Types - ประเภทข้อมูลงาน
// ============================================

/**
 * ระดับความสำคัญของงาน
 */
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * ข้อมูลคอลัมน์ Kanban
 */
export interface KanbanColumn {
  id: number;
  name: string;
  color: string;
  order: number;
  isDefault: boolean;
}

/**
 * ข้อมูลงาน
 */
export interface Task {
  id: number;
  title: string;
  description: string | null;
  columnId: number;
  column?: KanbanColumn;
  priority: TaskPriority;
  assigneeId: number | null;
  assignee: User | null;
  reminderAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ข้อมูลสำหรับสร้างงานใหม่
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  columnId?: number;
  assigneeId?: number;
}

/**
 * ข้อมูลสำหรับอัปเดตงาน
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  columnId?: number;
  priority?: TaskPriority;
  assigneeId?: number | null;
  reminderAt?: string | null;
  archivedAt?: string | null;
}

// ============================================
// Leave Types - ประเภทข้อมูลการลา
// ============================================

/**
 * ประเภทการลา
 */
export type LeaveType = 'SICK' | 'PERSONAL' | 'VACATION' | 'MATERNITY' | 'ORDINATION' | 'OTHER';

/**
 * สถานะการลา
 */
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * ข้อมูลการลา
 */
export interface Leave {
  id: number;
  userId: number;
  user: User;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: LeaveStatus;
  approvedBy: number | null;
  approvedAt: Date | null;
  isHalfDay: boolean;
  hours: number | null;
  totalDays: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ข้อมูลสำหรับสร้างรายการลาใหม่
 */
export interface CreateLeaveInput {
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason: string;
  isHalfDay?: boolean;
  hours?: number;
}

/**
 * ข้อมูลสำหรับอัปเดตสถานะการลา
 */
export interface UpdateLeaveInput {
  status: LeaveStatus;
}

// ============================================
// Position Types - ประเภทข้อมูลตำแหน่ง (Input)
// ============================================

/**
 * ข้อมูลสำหรับสร้าง/อัปเดตตำแหน่ง
 */
export interface CreatePositionInput {
  name: string;
  description?: string;
  order?: number;
}

export interface CreatePositionSecondInput {
  name: string;
  description?: string;
  hasLevel?: boolean;
  maxLevel?: number;
  order?: number;
}

export interface CreateDepartmentInput {
  name: string;
  description?: string;
  order?: number;
}

// ============================================
// API Response Types - ประเภทข้อมูลการตอบกลับ API
// ============================================

/**
 * โครงสร้างการตอบกลับ API มาตรฐาน
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

/**
 * โครงสร้างข้อผิดพลาด API
 */
export interface ApiError {
  success: false;
  error: string;
  message: string;
  details?: Record<string, string[]>;
}

// ============================================
// Dashboard Types - ประเภทข้อมูลแดชบอร์ด
// ============================================

/**
 * ข้อมูลสถิติแดชบอร์ด
 */
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  pendingLeaves: number;
  totalLeaves: number;
  inProgressTasks: number;
  doneTasks: number;
  totalTasks: number;
  // ข้อมูลเพิ่มเติมสำหรับระบบ column ใหม่
  tasksByColumn?: { columnId: number; columnName: string; count: number }[];
}

/**
 * ข้อมูลกิจกรรมล่าสุด
 */
export interface RecentActivity {
  id: number;
  type: 'TASK_CREATED' | 'TASK_UPDATED' | 'LEAVE_REQUESTED' | 'LEAVE_APPROVED' | 'USER_CREATED';
  description: string;
  user: string;
  createdAt: Date;
}

// ============================================
// Auth Types - ประเภทข้อมูลการเข้าสู่ระบบ
// ============================================

/**
 * ข้อมูลสำหรับเข้าสู่ระบบ
 */
export interface LoginInput {
  username: string;
  password: string;
}

/**
 * ข้อมูลการเข้าสู่ระบบสำเร็จ
 */
export interface LoginResponse {
  user: SessionUser;
  token: string;
  expiresAt: Date;
}

/**
 * ข้อมูลสำหรับเปลี่ยนรหัสผ่าน
 */
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// ============================================
// Component Props Types - ประเภทข้อมูล Props ของ Components
// ============================================

/**
 * Props สำหรับ component ที่รับ children
 */
export interface ChildrenProps {
  children: React.ReactNode;
}

/**
 * Props สำหรับ component ที่รับ className
 */
export interface ClassNameProps {
  className?: string;
}

/**
 * Props สำหรับ Modal component
 */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Props สำหรับ Badge component
 */
export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

// ============================================
// Form Types - ประเภทข้อมูลฟอร์ม
// ============================================

/**
 * สถานะของฟอร์ม
 */
export type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

/**
 * ข้อผิดพลาดของฟอร์ม
 */
export interface FormErrors {
  [key: string]: string[];
}

/**
 * ข้อมูลฟอร์มพื้นฐาน
 */
export interface FormState<T = Record<string, unknown>> {
  data: T;
  errors: FormErrors;
  status: FormStatus;
}
