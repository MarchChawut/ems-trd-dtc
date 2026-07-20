import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { setupTestDatabase } from '@tests/helpers/with-test-db';
import { createTestUser } from '@tests/helpers/auth';
import { mockCookieStore } from '@tests/helpers/mock-cookies';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/security';

setupTestDatabase();

function req(body: unknown, headers?: Record<string, string>) {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  it('returns 400 for invalid credentials shape', async () => {
    const res = await POST(req({ username: 'ab', password: 'short' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 401 and logs a failed attempt when the user does not exist', async () => {
    const res = await POST(req({ username: 'nobody_here', password: 'password123' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('INVALID_CREDENTIALS');

    const attempts = await prisma.loginAttempt.findMany({ where: { username: 'nobody_here' } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].success).toBe(false);
  });

  it('returns 403 for a disabled account', async () => {
    const user = await createTestUser('EMPLOYEE', { isActive: false });
    const res = await POST(req({ username: user.username, password: 'Test1234!' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('ACCOUNT_DISABLED');
  });

  it('returns 401 for a wrong password', async () => {
    const user = await createTestUser('EMPLOYEE');
    const res = await POST(req({ username: user.username, password: 'WrongPassword1' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('INVALID_CREDENTIALS');
  });

  it('on correct credentials without 2FA enabled, requires ENROLL and sets a pending-challenge cookie', async () => {
    const user = await createTestUser('EMPLOYEE');
    const res = await POST(req({ username: user.username, password: 'Test1234!' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.requires2FA).toBe(true);
    expect(body.data.mode).toBe('ENROLL');

    expect(mockCookieStore.get('2fa_pending')).toBeDefined();
    const challenges = await prisma.twoFactorChallenge.findMany({ where: { userId: user.id } });
    expect(challenges).toHaveLength(1);
  });

  it('on correct credentials with 2FA already enabled, requires VERIFY mode', async () => {
    const user = await prisma.user.create({
      data: {
        username: 'user2fa',
        email: 'user2fa@example.test',
        password: await hashPassword('Test1234!'),
        name: '2FA User',
        role: 'EMPLOYEE',
        twoFactorEnabled: true,
        twoFactorSecret: 'irrelevant-for-this-test',
      },
    });
    const res = await POST(req({ username: user.username, password: 'Test1234!' }));
    const body = await res.json();
    expect(body.data.mode).toBe('VERIFY');
  });

  it('returns 429 once the client IP has hit the rate limit', async () => {
    const ip = '10.0.0.5';
    for (let i = 0; i < 5; i++) {
      await prisma.loginAttempt.create({
        data: { username: 'someone', ipAddress: ip, success: false, reason: 'test seed' },
      });
    }

    const res = await POST(req({ username: 'someone', password: 'password123' }, { 'x-forwarded-for': ip }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('TOO_MANY_ATTEMPTS');
  });

  it('a successful password check clears prior failed attempts for that IP and username', async () => {
    const user = await createTestUser('EMPLOYEE');
    const ip = '10.0.0.9';
    await prisma.loginAttempt.create({
      data: { username: user.username, ipAddress: ip, success: false, reason: 'prior failure' },
    });

    const res = await POST(req({ username: user.username, password: 'Test1234!' }, { 'x-forwarded-for': ip }));
    expect(res.status).toBe(200);

    const remaining = await prisma.loginAttempt.findMany({ where: { ipAddress: ip } });
    expect(remaining).toHaveLength(0);
  });
});
