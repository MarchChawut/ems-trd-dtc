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

describe('GET /api/leaves/export', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await GET(req('/api/leaves/export'));
    expect(res.status).toBe(401);
  });

  it('exports a CSV with a BOM, Thai headers, and a content-disposition attachment header', async () => {
    await loginAsNewUser('EMPLOYEE');
    const employee = await createTestUser('EMPLOYEE', { name: 'สมชาย ใจดี' });
    await prisma.leave.create({
      data: { userId: employee.id, type: 'SICK', startDate: new Date('2026-07-06'), endDate: new Date('2026-07-06'), reason: 'ป่วย', totalDays: 1 },
    });

    const res = await GET(req('/api/leaves/export'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('attachment');

    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM, for Excel

    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('รหัส');
    expect(text).toContain('สมชาย ใจดี');
  });

  it('respects a restricted columns list', async () => {
    await loginAsNewUser('EMPLOYEE');
    const employee = await createTestUser('EMPLOYEE');
    await prisma.leave.create({
      data: { userId: employee.id, type: 'SICK', startDate: new Date('2026-07-06'), endDate: new Date('2026-07-06'), reason: 'x', totalDays: 1 },
    });

    const res = await GET(req('/api/leaves/export?columns=name,status'));
    const text = await res.text();
    const headerLine = text.replace('﻿', '').split('\n')[0];
    expect(headerLine).toBe('ชื่อพนักงาน,สถานะ');
  });

  it('returns an empty (header-less) body when there are no leaves to export', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await GET(req('/api/leaves/export'));
    const text = await res.text();
    expect(text).toBe('');
  });
});
