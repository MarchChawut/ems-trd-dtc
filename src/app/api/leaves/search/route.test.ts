import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { setupTestDatabase } from '@tests/helpers/with-test-db';
import { loginAsNewUser, createTestUser } from '@tests/helpers/auth';
import { prisma } from '@/lib/prisma';

setupTestDatabase();

function req(url: string) {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

describe('GET /api/leaves/search', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await GET(req('/api/leaves/search'));
    expect(res.status).toBe(401);
  });

  it('searches by employee name', async () => {
    await loginAsNewUser('MANAGER');
    const employee = await createTestUser('EMPLOYEE', { name: 'สมชาย ใจดี' });
    await prisma.leave.create({
      data: { userId: employee.id, type: 'SICK', startDate: new Date('2026-07-06'), endDate: new Date('2026-07-06'), reason: 'x', totalDays: 1 },
    });

    const res = await GET(req('/api/leaves/search?name=สมชาย'));
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.count).toBe(1);
  });

  it('finds leaves covering a specific date', async () => {
    await loginAsNewUser('MANAGER');
    const employee = await createTestUser('EMPLOYEE');
    await prisma.leave.create({
      data: { userId: employee.id, type: 'SICK', startDate: new Date('2026-07-06'), endDate: new Date('2026-07-08'), reason: 'x', totalDays: 3 },
    });

    const hit = await GET(req('/api/leaves/search?date=2026-07-07'));
    expect((await hit.json()).data).toHaveLength(1);

    const miss = await GET(req('/api/leaves/search?date=2026-07-09'));
    expect((await miss.json()).data).toHaveLength(0);
  });

  it('filters by formCategory', async () => {
    await loginAsNewUser('MANAGER');
    const employee = await createTestUser('EMPLOYEE');
    await prisma.leave.create({
      data: { userId: employee.id, type: 'SICK', startDate: new Date('2026-07-06'), endDate: new Date('2026-07-06'), reason: 'x', totalDays: 1, formCategory: 'KBK' },
    });
    await prisma.leave.create({
      data: { userId: employee.id, type: 'SICK', startDate: new Date('2026-07-06'), endDate: new Date('2026-07-06'), reason: 'y', totalDays: 1, formCategory: 'STATS' },
    });

    const res = await GET(req('/api/leaves/search?formCategory=KBK'));
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].formCategory).toBe('KBK');
  });
});
