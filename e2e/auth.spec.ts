import { test, expect } from '@playwright/test';
import { loginAs, loginWithCredentials } from './helpers/login';
import { E2E_ADMIN_USERNAME, E2E_PASSWORD } from './constants';

test.describe('เข้าสู่ระบบ (auth)', () => {
  test('ล็อกอินสำเร็จด้วย username/password + TOTP จริง แล้วออกจากระบบได้', async ({ page }) => {
    await loginAs(page, E2E_ADMIN_USERNAME, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('button', { name: 'ออกจากระบบ' }).first().click();
    await page.waitForURL('http://localhost:3100/');
    await expect(page.getByLabel('ชื่อผู้ใช้')).toBeVisible();
  });

  test('แสดงข้อผิดพลาดเมื่อกรอกรหัสผ่านผิด', async ({ page }) => {
    await loginWithCredentials(page, E2E_ADMIN_USERNAME, 'WrongPassword123!');
    await expect(page.getByText('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')).toBeVisible();
    await expect(page.getByLabel('ชื่อผู้ใช้')).toBeVisible();
  });

  test('แสดงข้อผิดพลาดเมื่อกรอกรหัส TOTP ผิด และยังไม่เข้า dashboard', async ({ page }) => {
    await loginWithCredentials(page, E2E_ADMIN_USERNAME, E2E_PASSWORD);
    await expect(page.getByPlaceholder('••••••')).toBeVisible();
    await page.getByPlaceholder('••••••').fill('000000');
    await page.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
    await expect(page.getByText('รหัสไม่ถูกต้อง กรุณาลองใหม่')).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});
