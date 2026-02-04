/**
 * ==================================================
 * Utility Functions - ฟังก์ชันอเนกประสงค์
 * ==================================================
 * ไฟล์นี้รวมฟังก์ชันช่วยเหลือต่างๆ ที่ใช้ทั่วไปในแอปพลิเคชัน
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * ฟังก์ชันสำหรับรวม class names ด้วย tailwind-merge
 * ใช้สำหรับจัดการ Tailwind CSS classes ที่อาจซ้ำกัน
 * 
 * @param inputs - class names ที่ต้องการรวม
 * @returns {string} class names ที่รวมกันแล้ว
 * 
 * ตัวอย่างการใช้งาน:
 * cn('px-4 py-2', 'bg-blue-500', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * ฟังก์ชันสำหรับจัดรูปแบบวันที่
 * @param date - วันที่ที่ต้องการจัดรูปแบบ
 * @param options - ตัวเลือกการจัดรูปแบบ
 * @returns {string} วันที่ในรูปแบบที่กำหนด
 * 
 * ตัวอย่างการใช้งาน:
 * formatDate(new Date()) // "4 ก.พ. 2567"
 * formatDate(new Date(), { year: 'numeric', month: 'long', day: 'numeric' }) // "4 กุมภาพันธ์ 2567"
 */
export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
): string {
  const d = new Date(date);
  
  // ตรวจสอบว่าวันที่ถูกต้องหรือไม่
  if (isNaN(d.getTime())) {
    return 'ไม่ระบุ';
  }
  
  return d.toLocaleDateString('th-TH', options);
}

/**
 * ฟังก์ชันสำหรับจัดรูปแบบเวลา
 * @param date - วันที่ที่ต้องการจัดรูปแบบ
 * @returns {string} เวลาในรูปแบบ HH:MM
 * 
 * ตัวอย่างการใช้งาน:
 * formatTime(new Date()) // "14:30"
 */
export function formatTime(date: Date | string | number): string {
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return '--:--';
  }
  
  return d.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * ฟังก์ชันสำหรับจัดรูปแบบวันที่และเวลา
 * @param date - วันที่ที่ต้องการจัดรูปแบบ
 * @returns {string} วันที่และเวลา
 * 
 * ตัวอย่างการใช้งาน:
 * formatDateTime(new Date()) // "4 ก.พ. 2567 14:30"
 */
export function formatDateTime(date: Date | string | number): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * ฟังก์ชันสำหรับคำนวณจำนวนวันระหว่างสองวันที่
 * @param startDate - วันที่เริ่มต้น
 * @param endDate - วันที่สิ้นสุด
 * @returns {number} จำนวนวัน
 * 
 * ตัวอย่างการใช้งาน:
 * calculateDays('2024-02-01', '2024-02-05') // 4
 */
export function calculateDays(startDate: Date | string, endDate: Date | string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * ฟังก์ชันสำหรับหน่วงเวลา (delay)
 * @param ms - จำนวนมิลลิวินาที
 * @returns {Promise<void>}
 * 
 * ตัวอย่างการใช้งาน:
 * await delay(1000); // รอ 1 วินาที
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ฟังก์ชันสำหรับตัดข้อความให้สั้นลง
 * @param text - ข้อความที่ต้องการตัด
 * @param maxLength - ความยาวสูงสุด
 * @param suffix - ข้อความต่อท้าย (default: '...')
 * @returns {string} ข้อความที่ตัดแล้ว
 * 
 * ตัวอย่างการใช้งาน:
 * truncate('This is a long text', 10) // "This is..."
 */
export function truncate(text: string, maxLength: number, suffix: string = '...'): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * ฟังก์ชันสำหรับแปลงตัวเลขให้มี comma คั่น
 * @param num - ตัวเลขที่ต้องการแปลง
 * @returns {string} ตัวเลขที่มี comma คั่น
 * 
 * ตัวอย่างการใช้งาน:
 * formatNumber(1000000) // "1,000,000"
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('th-TH');
}

/**
 * ฟังก์ชันสำหรับตรวจสอบว่าอีเมลถูกต้องหรือไม่
 * @param email - อีเมลที่ต้องการตรวจสอบ
 * @returns {boolean} true หากอีเมลถูกต้อง
 * 
 * ตัวอย่างการใช้งาน:
 * isValidEmail('test@example.com') // true
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * ฟังก์ชันสำหรับสร้าง slug จากข้อความ
 * @param text - ข้อความที่ต้องการแปลง
 * @returns {string} slug ที่สร้างขึ้น
 * 
 * ตัวอย่างการใช้งาน:
 * slugify('Hello World') // "hello-world"
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')       // แทนที่ช่องว่างด้วย -
    .replace(/[^\w\-]+/g, '')   // ลบอักขระพิเศษ
    .replace(/\-\-+/g, '-');    // แทนที่ multiple - ด้วย single -
}

/**
 * ฟังก์ชันสำหรับสร้าง UUID v4
 * @returns {string} UUID ที่สร้างขึ้น
 * 
 * ตัวอย่างการใช้งาน:
 * generateUUID() // "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * ฟังก์ชันสำหรับตรวจสอบว่าอยู่ใน environment ของ browser หรือไม่
 * @returns {boolean} true หากอยู่ใน browser
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * ฟังก์ชันสำหรับตรวจสอบว่าอยู่ใน environment ของ server หรือไม่
 * @returns {boolean} true หากอยู่ใน server
 */
export function isServer(): boolean {
  return typeof window === 'undefined';
}
