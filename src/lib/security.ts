/**
 * ==================================================
 * Security Utilities - เครื่องมือความปลอดภัย
 * ==================================================
 * ไฟล์นี้รวมฟังก์ชันสำหรับการเข้ารหัส การตรวจสอบ
 * และการป้องกันภัยคุกคามต่างๆ
 */

import bcrypt from 'bcryptjs';
import { z } from 'zod';

// ============================================
// การตั้งค่าความปลอดภัย
// ============================================
const SALT_ROUNDS = 12; // จำนวนรอบการเข้ารหัส bcrypt
const MAX_LOGIN_ATTEMPTS = 5; // จำนวนครั้งสูงสุดที่อนุญาตให้เข้าสู่ระบบผิดพลาด
const LOCKOUT_DURATION = 30 * 60 * 1000; // ระยะเวลาบล็อก (30 นาทีเป็นมิลลิวินาที)

// ============================================
// ฟังก์ชันการเข้ารหัสรหัสผ่าน
// ============================================

/**
 * เข้ารหัสรหัสผ่านด้วย bcrypt
 * @param password - รหัสผ่านที่ต้องการเข้ารหัส
 * @returns {Promise<string>} รหัสผ่านที่เข้ารหัสแล้ว
 * 
 * ตัวอย่างการใช้งาน:
 * const hashedPassword = await hashPassword('myPassword123');
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * ตรวจสอบรหัสผ่านกับ hash
 * @param password - รหัสผ่านที่ผู้ใช้ป้อน
 * @param hashedPassword - hash ที่เก็บในฐานข้อมูล
 * @returns {Promise<boolean>} true หากรหัสผ่านถูกต้อง
 * 
 * ตัวอย่างการใช้งาน:
 * const isValid = await verifyPassword('myPassword123', storedHash);
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// ============================================
// การตรวจสอบข้อมูลด้วย Zod Schema
// ============================================

/**
 * Schema สำหรับตรวจสอบการเข้าสู่ระบบ
 */
export const loginSchema = z.object({
  username: z
    .string()
    .min(3, 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร')
    .max(100, 'ชื่อผู้ใช้ต้องไม่เกิน 100 ตัวอักษร')
    .regex(/^[a-zA-Z0-9_]+$/, 'ชื่อผู้ใช้ต้องประกอบด้วยตัวอักษร ตัวเลข หรือ underscore เท่านั้น'),
  password: z
    .string()
    .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
    .max(128, 'รหัสผ่านต้องไม่เกิน 128 ตัวอักษร'),
});

/**
 * Schema สำหรับตรวจสอบการสร้างผู้ใช้ใหม่
 */
export const createUserSchema = z.object({
  email: z
    .string()
    .email('รูปแบบอีเมลไม่ถูกต้อง')
    .max(255, 'อีเมลต้องไม่เกิน 255 ตัวอักษร'),
  username: z
    .string()
    .min(3, 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร')
    .max(100, 'ชื่อผู้ใช้ต้องไม่เกิน 100 ตัวอักษร')
    .regex(/^[a-zA-Z0-9_]+$/, 'ชื่อผู้ใช้ต้องประกอบด้วยตัวอักษร ตัวเลข หรือ underscore เท่านั้น'),
  password: z
    .string()
    .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
    .max(128, 'รหัสผ่านต้องไม่เกิน 128 ตัวอักษร')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'รหัสผ่านต้องมีตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ และตัวเลข'),
  name: z
    .string()
    .min(1, 'กรุณาระบุชื่อ')
    .max(100, 'ชื่อต้องไม่เกิน 100 ตัวอักษร'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'HR']),
  department: z.string().max(100).optional(),
});

/**
 * Schema สำหรับตรวจสอบการสร้างงานใหม่
 */
export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'กรุณาระบุชื่องาน')
    .max(255, 'ชื่องานต้องไม่เกิน 255 ตัวอักษร'),
  description: z.string().max(1000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assigneeId: z.number().int().positive().optional(),
});

/**
 * Schema สำหรับตรวจสอบการสร้างรายการลา
 */
export const createLeaveSchema = z.object({
  type: z.enum(['SICK', 'PERSONAL', 'VACATION', 'OTHER']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD'),
  reason: z
    .string()
    .min(1, 'กรุณาระบุเหตุผล')
    .max(500, 'เหตุผลต้องไม่เกิน 500 ตัวอักษร'),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end >= start;
}, {
  message: 'วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น',
  path: ['endDate'],
});

// ============================================
// การป้องกัน XSS (Cross-Site Scripting)
// ============================================

/**
 * ฟังก์ชันสำหรับทำความสะอาดข้อความ (Sanitize)
 * ป้องกัน XSS โดยการแปลงอักขระพิเศษ
 * @param input - ข้อความที่ต้องการทำความสะอาด
 * @returns {string} ข้อความที่ปลอดภัย
 * 
 * ตัวอย่างการใช้งาน:
 * const safeText = sanitizeInput('<script>alert("xss")</script>');
 * // ผลลัพธ์: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * ฟังก์ชันสำหรับตรวจสอบว่าข้อความมี HTML tags หรือไม่
 * @param input - ข้อความที่ต้องการตรวจสอบ
 * @returns {boolean} true หากพบ HTML tags
 */
export function containsHtml(input: string): boolean {
  const htmlRegex = /<[^>]*>/;
  return htmlRegex.test(input);
}

// ============================================
// การป้องกัน SQL Injection
// ============================================

/**
 * ฟังก์ชันสำหรับตรวจสอบว่าข้อความมี SQL injection patterns หรือไม่
 * @param input - ข้อความที่ต้องการตรวจสอบ
 * @returns {boolean} true หากพบ patterns ที่น่าสงสัย
 */
export function containsSqlInjection(input: string): boolean {
  const sqlPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i,
    /exec(\s|\+)+(s|x)p\w+/i,
    /UNION\s+SELECT/i,
    /INSERT\s+INTO/i,
    /DELETE\s+FROM/i,
    /DROP\s+TABLE/i,
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
}

// ============================================
// การป้องกัน Brute Force
// ============================================

// เก็บข้อมูลการพยายามเข้าสู่ระบบใน memory (ควรใช้ Redis ใน production)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

/**
 * ฟังก์ชันสำหรับตรวจสอบว่า IP ถูกบล็อกหรือไม่
 * @param identifier - IP address หรือ username
 * @returns {boolean} true หากถูกบล็อก
 */
export function isRateLimited(identifier: string): boolean {
  const attempt = loginAttempts.get(identifier);
  
  if (!attempt) return false;
  
  // ตรวจสอบว่าเลยเวลาบล็อกหรือยัง
  if (Date.now() - attempt.lastAttempt > LOCKOUT_DURATION) {
    loginAttempts.delete(identifier);
    return false;
  }
  
  return attempt.count >= MAX_LOGIN_ATTEMPTS;
}

/**
 * ฟังก์ชันสำหรับบันทึกการพยายามเข้าสู่ระบบ
 * @param identifier - IP address หรือ username
 * @param success - สถานะการเข้าสู่ระบบ
 */
export function recordLoginAttempt(identifier: string, success: boolean): void {
  if (success) {
    // ล้างข้อมูลการพยายามหากเข้าสู่ระบบสำเร็จ
    loginAttempts.delete(identifier);
    return;
  }
  
  const attempt = loginAttempts.get(identifier);
  
  if (attempt) {
    attempt.count += 1;
    attempt.lastAttempt = Date.now();
  } else {
    loginAttempts.set(identifier, { count: 1, lastAttempt: Date.now() });
  }
}

/**
 * ฟังก์ชันสำหรับดึงข้อมูลการพยายามเข้าสู่ระบบ
 * @param identifier - IP address หรือ username
 * @returns {object|null} ข้อมูลการพยายามเข้าสู่ระบบ
 */
export function getLoginAttempts(identifier: string): { count: number; remainingAttempts: number; isLocked: boolean } | null {
  const attempt = loginAttempts.get(identifier);
  
  if (!attempt) {
    return { count: 0, remainingAttempts: MAX_LOGIN_ATTEMPTS, isLocked: false };
  }
  
  const isLocked = isRateLimited(identifier);
  const remainingAttempts = Math.max(0, MAX_LOGIN_ATTEMPTS - attempt.count);
  
  return { count: attempt.count, remainingAttempts, isLocked };
}

// ============================================
// การสร้าง Token ที่ปลอดภัย
// ============================================

/**
 * ฟังก์ชันสำหรับสร้าง random token
 * @param length - ความยาวของ token
 * @returns {string} token ที่สร้างขึ้น
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return token;
}

/**
 * ฟังก์ชันสำหรับสร้างตัวย่อชื่อ (Avatar)
 * @param name - ชื่อเต็ม
 * @returns {string} ตัวย่อ 1-2 ตัวอักษร
 */
export function generateAvatarInitials(name: string): string {
  if (!name) return 'U';
  
  const names = name.trim().split(/\s+/);
  
  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase();
  }
  
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
}
