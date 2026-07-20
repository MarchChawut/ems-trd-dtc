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
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'DIRECTOR' | 'EMPLOYEE' | 'HR';

/**
 * ข้อมูลผู้ใช้พื้นฐาน (ไม่รวมรหัสผ่าน)
 * ใช้สำหรับส่งข้อมูลผู้ใช้ไปยัง client
 */
export interface User {
  id: number;
  email: string | null;
  username: string;
  prefix: string | null; // คำนำหน้า เช่น นาย, น.ส., ร.ต.
  name: string;
  role: UserRole;
  department: string | null; // กอง เช่น กองการศึกษา วิจัย และพัฒนา
  division: string | null; // สังกัด เช่น ศูนย์เทคโนโลยีดิจิทัล สำนักพระราชวัง
  position: string | null; // ตำแหน่ง เช่น จนท.ฝ่ายธุรการ
  positionSecond: string | null; // ตำแหน่งรอง เช่น เจ้าหน้าที่งานในพระองค์
  positionLevel: number | null; // ระดับ 1-11
  phone: string | null; // เบอร์โทรศัพท์
  birthday: Date | string | null; // วันเกิด
  address: string | null; // ที่อยู่
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
  email: string | null;
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
  email?: string | null;
  prefix?: string | null;
  name?: string;
  role?: UserRole;
  department?: string;
  division?: string;
  position?: string;
  positionSecond?: string;
  positionLevel?: number;
  phone?: string | null;
  birthday?: string | null; // YYYY-MM-DD
  address?: string | null;
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
  reminderSentAt: Date | null;
  reminderDayBeforeAt: Date | null;
  reminderDayBeforeSentAt: Date | null;
  reminderOnDayAt: Date | null;
  reminderOnDaySentAt: Date | null;
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
export type LeaveType = 'SICK' | 'PERSONAL' | 'MATERNITY' | 'ORDINATION' | 'EARLY_LEAVE' | 'LATE_ARRIVAL' | 'RUN_AN_ERRAND' | 'OTHER';

/**
 * สถานะการลา
 */
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * ประเภทแบบฟอร์ม (เลือกได้อย่างเดียว)
 */
export type LeaveFormCategory = 'KBK' | 'STATS';

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
  outTime: string | null;
  backTime: string | null;
  formCategory: LeaveFormCategory | null;
  totalDays: number;
  contactAddress: string | null;
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
  outTime?: string; // เวลาออก (HH:mm)
  backTime?: string; // เวลากลับ (HH:mm)
  formCategory?: LeaveFormCategory | null;
  contactAddress?: string; // สถานที่พักขณะลา
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
// Holiday Types - วันหยุดของหน่วยงาน
// ============================================

/**
 * ข้อมูลวันหยุด
 */
export interface Holiday {
  id: number;
  date: string; // YYYY-MM-DD
  name: string;
  description: string | null;
  year: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ข้อมูลสำหรับสร้างวันหยุดใหม่
 */
export interface CreateHolidayInput {
  date: string;
  name: string;
  description?: string;
  year?: number;
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
  // ข้อมูลเพิ่มเติมสำหรับภาพรวมพัสดุ/ครุภัณฑ์
  lowStockCount?: number;
  assetsInUse?: number;
  assetsInRepair?: number;
  overdueCheckoutsCount?: number;
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

/**
 * สรุปพัสดุใกล้หมด (สำหรับ widget แดชบอร์ด)
 */
export interface LowStockSupplySummary {
  id: number;
  name: string;
  unit: string | null;
  currentQuantity: number;
  minimumQuantity: number;
  category: Pick<SupplyCategory, 'id' | 'name'> | null;
}

/**
 * สรุปรายการยืมครุภัณฑ์ที่เกินกำหนดคืน (สำหรับ widget แดชบอร์ด)
 */
export interface OverdueCheckoutSummary {
  id: number;
  expectedReturnAt: string;
  asset: Pick<Asset, 'id' | 'name' | 'assetTag'>;
  holder: Pick<User, 'id' | 'name' | 'avatar' | 'department'>;
}

/**
 * รายการคำขอลารออนุมัติล่าสุด (สำหรับ widget แดชบอร์ด)
 */
export interface RecentPendingLeaveSummary extends Omit<Leave, 'user'> {
  user: Pick<User, 'id' | 'name' | 'avatar' | 'department'>;
}

/**
 * รายการงานล่าสุด (สำหรับ widget แดชบอร์ด)
 */
export interface RecentTaskSummary extends Omit<Task, 'column' | 'assignee'> {
  column: KanbanColumn;
  assignee: Pick<User, 'id' | 'name' | 'avatar'> | null;
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

// ============================================
// Supply Types - ประเภทข้อมูลพัสดุ
// ============================================

export type SupplyType = 'STOCK' | 'NON_STOCK';
export type TransactionType = 'RECEIVE' | 'ISSUE' | 'RETURN' | 'ADJUST';

export interface SupplyCategory {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Supply {
  id: number;
  name: string;
  type: SupplyType;
  categoryId: number | null;
  category?: SupplyCategory | null;
  supplyCode: string | null;
  unit: string | null;
  currentQuantity: number;
  minimumQuantity: number;
  maximumQuantity: number;
  thresholdRed: number;
  thresholdYellow: number;
  supplier: string | null;
  unitPrice: number | null;
  documentNumber: string | null;
  documentUrl: string | null;
  imageUrl: string | null;
  issueDate: Date | string | null;
  recorderName: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplyTransaction {
  id: number;
  supplyId: number;
  supply?: Supply;
  type: TransactionType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  documentNumber: string | null;
  documentUrl: string | null;
  recipientName: string | null;
  notes: string | null;
  performedById: number;
  performedBy?: Pick<User, 'id' | 'prefix' | 'name' | 'avatar'>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSupplyInput {
  name: string;
  type: SupplyType;
  categoryId?: number | null;
  unit?: string | null;
  minimumQuantity?: number;
  supplier?: string | null;
  unitPrice?: number | null;
  documentNumber?: string | null;
  documentUrl?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
}

export interface CreateTransactionInput {
  supplyId: number;
  type: TransactionType;
  quantity: number;
  documentNumber?: string | null;
  documentUrl?: string | null;
  recipientName?: string | null;
  notes?: string | null;
}

// ============================================
// Asset Types - ประเภทข้อมูลครุภัณฑ์
// ============================================

export type AssetStatus = 'AVAILABLE' | 'IN_USE' | 'IN_REPAIR' | 'RETURNED' | 'DISPOSED';
export type AssetCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';

export interface AssetCategory {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Asset {
  id: number;
  name: string;
  assetTag: string | null;
  serialNumber: string | null;
  model: string | null;
  brand: string | null;
  categoryId: number | null;
  category?: AssetCategory | null;
  status: AssetStatus;
  condition: AssetCondition;
  currentHolderId: number | null;
  currentHolder?: Pick<User, 'id' | 'prefix' | 'name' | 'avatar'> | null;
  acquisitionDate: Date | string | null;
  acquisitionCost: number | null;
  documentNumber: string | null;
  documentUrl: string | null;
  location: string | null;
  department: string | null;
  imageUrl: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetCheckout {
  id: number;
  assetId: number;
  asset?: Asset;
  holderId: number;
  holder?: Pick<User, 'id' | 'prefix' | 'name' | 'avatar' | 'department'>;
  issuedById: number;
  issuedBy?: Pick<User, 'id' | 'name' | 'avatar'>;
  checkedOutAt: Date;
  returnedAt: Date | null;
  expectedReturnAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAssetInput {
  name: string;
  assetTag?: string | null;
  serialNumber?: string | null;
  model?: string | null;
  brand?: string | null;
  categoryId?: number | null;
  status?: AssetStatus;
  condition?: AssetCondition;
  acquisitionDate?: string | null;
  acquisitionCost?: number | null;
  documentNumber?: string | null;
  documentUrl?: string | null;
  location?: string | null;
  department?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
}

export interface CreateCheckoutInput {
  assetId: number;
  holderId: number;
  expectedReturnAt?: string | null;
  notes?: string | null;
}

// ============================================
// Document Register Types - ประเภทข้อมูลทะเบียนรับ-ส่งเอกสาร
// ============================================

export type DocumentDirection = 'RECEIVE' | 'SEND';
export type DocumentCategory = 'MEMO' | 'EXTERNAL_LETTER' | 'PW_NEWS' | 'VEHICLE_SUPPORT_REQUEST' | 'REFRESHMENT_SUPPORT_REQUEST';

export interface DocumentRegister {
  id: number;
  date: Date | string;
  subject: string;
  direction: DocumentDirection;
  category: DocumentCategory | null;
  documentNumber: string | null;
  recipientName: string | null;
  senderName: string | null;
  remarks: string | null;
  recordedById: number;
  recordedBy?: Pick<User, 'id' | 'prefix' | 'name' | 'avatar'>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentRegisterInput {
  date: string;
  subject: string;
  direction: DocumentDirection;
  category: DocumentCategory;
  documentNumber?: string | null;
  recipientName?: string | null;
  senderName?: string | null;
  remarks?: string | null;
}
