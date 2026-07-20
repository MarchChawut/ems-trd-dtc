/**
 * Helper สำหรับสร้างผู้ใช้เทส + session จริงในฐานข้อมูลเทส แล้วผูกเข้ากับ
 * mock cookie store (ดู tests/helpers/mock-cookies.ts) เพื่อจำลองว่าล็อกอินอยู่
 */

import { prisma } from '@/lib/prisma';
import { hashPassword, generateAvatarInitials, generateSecureToken } from '@/lib/security';
import type { UserRole } from '@/types';
import { setMockSessionToken } from './mock-cookies';

let counter = 0;

export async function createTestUser(
  role: UserRole = 'EMPLOYEE',
  overrides: Partial<{ name: string; username: string; email: string; department: string; isActive: boolean }> = {}
) {
  counter += 1;
  const name = overrides.name ?? `Test User ${counter}`;
  const username = overrides.username ?? `testuser${counter}`;
  const password = await hashPassword('Test1234!');

  return prisma.user.create({
    data: {
      username,
      email: overrides.email ?? `${username}@example.test`,
      password,
      name,
      role,
      department: overrides.department,
      avatar: generateAvatarInitials(name),
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function createSessionForUser(userId: number): Promise<string> {
  const token = generateSecureToken(64);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { userId, token, expiresAt, isValid: true },
  });

  return token;
}

/** สร้างผู้ใช้เทส + session แล้วตั้งเป็น "ล็อกอินอยู่" ผ่าน mock cookie ให้พร้อมเรียก route handler */
export async function loginAsNewUser(role: UserRole = 'EMPLOYEE') {
  const user = await createTestUser(role);
  const token = await createSessionForUser(user.id);
  setMockSessionToken(token);
  return user;
}
