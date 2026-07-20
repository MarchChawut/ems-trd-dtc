/**
 * Helper ล็อกอินสำหรับ E2E — ใช้ flow จริงทั้งหมด (username/password → TOTP → session)
 * ไม่ mock อะไรเลย: คำนวณรหัส TOTP จริงจาก E2E_TOTP_SECRET ด้วย otplib ตัวเดียวกับที่
 * ผู้ใช้จริงต้องกรอกจากแอป authenticator ของตัวเอง — เพื่อทดสอบ path /api/auth/2fa/verify จริง
 */

import { Page, expect } from '@playwright/test';
import { generate as generateTotp } from 'otplib';
import { E2E_TOTP_SECRET } from '../constants';

export async function loginWithCredentials(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  await page.goto('/');
  await page.getByLabel('ชื่อผู้ใช้').fill(username);
  await page.getByLabel('รหัสผ่าน').fill(password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
}

export async function completeTotpVerification(page: Page): Promise<void> {
  const code = await generateTotp({ secret: E2E_TOTP_SECRET });
  await page.getByPlaceholder('••••••').fill(code);
  await page.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
}

/** ล็อกอินแบบครบ flow (credentials + TOTP จริง) จนถึงหน้า /dashboard */
export async function loginAs(page: Page, username: string, password: string): Promise<void> {
  await loginWithCredentials(page, username, password);
  await expect(page.getByPlaceholder('••••••')).toBeVisible();
  await completeTotpVerification(page);
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('link', { name: 'หน้าหลัก' })).toBeVisible();
}
