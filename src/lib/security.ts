/**
 * ==================================================
 * Security Utilities - เครื่องมือความปลอดภัย
 * ==================================================
 * ไฟล์นี้รวมฟังก์ชันสำหรับการเข้ารหัส การตรวจสอบ
 * และการป้องกันภัยคุกคามต่างๆ
 */

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomBytes, randomInt } from 'node:crypto';

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
  prefix: z.string().max(50).nullable().optional(),
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
  columnId: z.number().int().positive().optional(),
  assigneeId: z.number().int().positive().optional(),
});

/**
 * Schema สำหรับตรวจสอบการสร้างรายการลา
 */
export const createLeaveSchema = z.object({
  type: z.enum(['SICK', 'PERSONAL', 'VACATION', 'MATERNITY', 'ORDINATION', 'EARLY_LEAVE', 'OTHER']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD'),
  reason: z
    .string()
    .min(1, 'กรุณาระบุเหตุผล')
    .max(500, 'เหตุผลต้องไม่เกิน 500 ตัวอักษร'),
  isHalfDay: z.boolean().optional(),
  hours: z.number().min(0).max(24).optional(),
  contactAddress: z.string().max(500, 'สถานที่พักต้องไม่เกิน 500 ตัวอักษร').optional(),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end >= start;
}, {
  message: 'วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น',
  path: ['endDate'],
});

// ============================================
// Schemas สำหรับ master data (positions, departments, ฯลฯ)
// ============================================

/** Numeric ID schema (สำหรับ path/query params ที่เป็น ID ของ master data) */
export const idSchema = z.coerce
  .number()
  .int('ID ต้องเป็นจำนวนเต็ม')
  .positive('ID ต้องเป็นค่าบวก');

/** ใช้ร่วม master data ที่มีโครงสร้างเหมือนกัน: positions, departments */
export const masterDataSchema = z.object({
  name: z
    .string()
    .min(1, 'กรุณาระบุชื่อ')
    .max(100, 'ชื่อต้องไม่เกิน 100 ตัวอักษร'),
  description: z.string().max(255, 'คำอธิบายต้องไม่เกิน 255 ตัวอักษร').nullable().optional(),
  order: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export const updateMasterDataSchema = masterDataSchema.partial().extend({
  id: idSchema,
});

/** PositionSecond มี field พิเศษ hasLevel/maxLevel */
export const positionSecondSchema = masterDataSchema.extend({
  hasLevel: z.boolean().optional(),
  maxLevel: z.number().int().min(1).max(20).nullable().optional(),
});

export const updatePositionSecondSchema = positionSecondSchema.partial().extend({
  id: idSchema,
});

/** Leave rule schema */
export const leaveRuleSchema = z.object({
  name: z.string().min(1).max(100),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'รูปแบบเวลาต้องเป็น HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'รูปแบบเวลาต้องเป็น HH:MM'),
  fullDayHours: z.number().positive().max(24).optional(),
  halfDayHours: z.number().positive().max(24).optional(),
  maxConsecutiveDays: z.number().int().min(1).max(365).optional(),
  isActive: z.boolean().optional(),
});

export const updateLeaveRuleSchema = leaveRuleSchema.partial().extend({
  id: idSchema,
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
 * ฟังก์ชันสำหรับสร้าง random token (cryptographically secure)
 * ใช้สำหรับ session tokens, CSRF tokens, ฯลฯ
 * @param length - ความยาวของ token (default 32)
 * @returns {string} token แบบ URL-safe base64
 */
export function generateSecureToken(length: number = 32): string {
  // randomBytes ส่งคืน base64 ที่ยาวกว่า input ~33% → ตัดให้ได้ length ตามที่ต้องการ
  const bytes = Math.ceil((length * 3) / 4);
  return randomBytes(bytes)
    .toString('base64url')
    .slice(0, length);
}

/**
 * สร้างรหัสผ่านชั่วคราวแบบสุ่ม (อ่านง่าย, จดง่าย)
 * รับประกันมี: ตัวพิมพ์ใหญ่ 1, ตัวพิมพ์เล็ก 1, ตัวเลข 1, ตัวพิเศษ 1
 * ไม่มีอักษรที่สับสน: I, l, 1, O, 0
 *
 * @param length - ความยาว (default 16, ขั้นต่ำ 12)
 * @returns รหัสผ่านชั่วคราว — ใช้ครั้งเดียว ผู้ใช้ควรเปลี่ยนทันที
 */
export function generateRandomPassword(length: number = 16): string {
  if (length < 12) {
    throw new Error('Password length must be at least 12 characters');
  }

  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digit = '23456789';
  const special = '!@#$%&*+=?';
  const all = upper + lower + digit + special;

  // รับประกันมีอย่างน้อย 1 ตัวจากทุกประเภท
  const required = [
    upper[randomInt(0, upper.length)],
    lower[randomInt(0, lower.length)],
    digit[randomInt(0, digit.length)],
    special[randomInt(0, special.length)],
  ];

  // เติมที่เหลือ
  const remaining: string[] = [];
  for (let i = required.length; i < length; i++) {
    remaining.push(all[randomInt(0, all.length)]);
  }

  // Fisher-Yates shuffle เพื่อสุ่มตำแหน่ง required chars
  const chars = [...required, ...remaining];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
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
