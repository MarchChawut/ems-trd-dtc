import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { setupTestDatabase } from '@tests/helpers/with-test-db';
import { loginAsNewUser, createTestUser } from '@tests/helpers/auth';
import { prisma } from '@/lib/prisma';

setupTestDatabase();

function req(url: string, init?: { method?: string; body?: unknown }) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: init?.method ?? 'GET',
    headers: init?.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

describe('GET /api/leaves', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await GET(req('/api/leaves'));
    expect(res.status).toBe(401);
  });

  it('a regular employee only sees their own leave requests', async () => {
    const me = await loginAsNewUser('EMPLOYEE');
    const other = await createTestUser('EMPLOYEE');
    await prisma.leave.create({
      data: { userId: me.id, type: 'SICK', startDate: new Date('2026-07-06'), endDate: new Date('2026-07-06'), reason: 'me', totalDays: 1 },
    });
    await prisma.leave.create({
      data: { userId: other.id, type: 'SICK', startDate: new Date('2026-07-06'), endDate: new Date('2026-07-06'), reason: 'other', totalDays: 1 },
    });

    const res = await GET(req('/api/leaves'));
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].userId).toBe(me.id);
  });

  it('a manager sees all leave requests and can filter by userId/status/type', async () => {
    const manager = await loginAsNewUser('MANAGER');
    const employee = await createTestUser('EMPLOYEE');
    await prisma.leave.create({
      data: { userId: employee.id, type: 'SICK', status: 'PENDING', startDate: new Date('2026-07-06'), endDate: new Date('2026-07-06'), reason: 'a', totalDays: 1 },
    });
    await prisma.leave.create({
      data: { userId: manager.id, type: 'PERSONAL', status: 'APPROVED', startDate: new Date('2026-07-06'), endDate: new Date('2026-07-06'), reason: 'b', totalDays: 1 },
    });

    const all = await GET(req('/api/leaves'));
    expect((await all.json()).data).toHaveLength(2);

    const filtered = await GET(req(`/api/leaves?userId=${employee.id}`));
    const filteredBody = await filtered.json();
    expect(filteredBody.data).toHaveLength(1);
    expect(filteredBody.data[0].userId).toBe(employee.id);

    const byStatus = await GET(req('/api/leaves?status=APPROVED'));
    expect((await byStatus.json()).data).toHaveLength(1);

    const byType = await GET(req('/api/leaves?type=PERSONAL'));
    expect((await byType.json()).data).toHaveLength(1);
  });

  it('supports pagination via page/limit', async () => {
    const manager = await loginAsNewUser('MANAGER');
    for (let i = 0; i < 3; i++) {
      await prisma.leave.create({
        data: { userId: manager.id, type: 'SICK', startDate: new Date('2026-07-06'), endDate: new Date('2026-07-06'), reason: `r${i}`, totalDays: 1 },
      });
    }

    const res = await GET(req('/api/leaves?page=1&limit=2'));
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.meta).toEqual({ total: 3, page: 1, limit: 2, hasMore: true });
  });
});

describe('POST /api/leaves', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await POST(
      req('/api/leaves', { method: 'POST', body: { type: 'SICK', startDate: '2026-07-06', endDate: '2026-07-06', reason: 'x' } })
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid input', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await POST(req('/api/leaves', { method: 'POST', body: { type: 'SICK' } }));
    expect(res.status).toBe(400);
  });

  it('creates a leave for self and computes totalDays (weekday-only)', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await POST(
      req('/api/leaves', {
        method: 'POST',
        body: { type: 'SICK', startDate: '2026-07-06', endDate: '2026-07-08', reason: 'ป่วย' },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.totalDays).toBe(3);
    expect(body.data.status).toBe('PENDING');
  });

  it('excludes holidays from the computed totalDays', async () => {
    await loginAsNewUser('EMPLOYEE');
    await prisma.holiday.create({ data: { name: 'วันหยุด', date: new Date('2026-07-07'), year: 2026, isActive: true } });

    const res = await POST(
      req('/api/leaves', {
        method: 'POST',
        body: { type: 'SICK', startDate: '2026-07-06', endDate: '2026-07-08', reason: 'ป่วย' },
      })
    );
    const body = await res.json();
    expect(body.data.totalDays).toBe(2);
  });

  it('an employee cannot create a leave on behalf of another user', async () => {
    const me = await loginAsNewUser('EMPLOYEE');
    const other = await createTestUser('EMPLOYEE');

    const res = await POST(
      req('/api/leaves', {
        method: 'POST',
        body: { userId: other.id, type: 'SICK', startDate: '2026-07-06', endDate: '2026-07-06', reason: 'x' },
      })
    );
    const body = await res.json();
    expect(body.data.userId).toBe(me.id);
  });

  it('a manager can create a leave on behalf of another user', async () => {
    await loginAsNewUser('MANAGER');
    const employee = await createTestUser('EMPLOYEE');

    const res = await POST(
      req('/api/leaves', {
        method: 'POST',
        body: { userId: employee.id, type: 'SICK', startDate: '2026-07-06', endDate: '2026-07-06', reason: 'x' },
      })
    );
    const body = await res.json();
    expect(body.data.userId).toBe(employee.id);
  });

  it('returns 404 when a manager targets a nonexistent user', async () => {
    await loginAsNewUser('MANAGER');
    const res = await POST(
      req('/api/leaves', {
        method: 'POST',
        body: { userId: 999999, type: 'SICK', startDate: '2026-07-06', endDate: '2026-07-06', reason: 'x' },
      })
    );
    expect(res.status).toBe(404);
  });

  it('an hours-based leave uses the hour-threshold rule instead of the date range', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await POST(
      req('/api/leaves', {
        method: 'POST',
        body: { type: 'LATE_ARRIVAL', startDate: '2026-07-06', endDate: '2026-07-06', reason: 'สาย', hours: 2 },
      })
    );
    const body = await res.json();
    expect(body.data.totalDays).toBe(0.5);
  });
});
