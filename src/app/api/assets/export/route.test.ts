import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { GET } from './route';
import { setupTestDatabase } from '@tests/helpers/with-test-db';
import { loginAsNewUser } from '@tests/helpers/auth';
import { prisma } from '@/lib/prisma';

setupTestDatabase();

function req(url = '/api/assets/export') {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

describe('GET /api/assets/export', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-manager', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('produces a valid xlsx workbook with two sheets', async () => {
    await loginAsNewUser('MANAGER');
    await prisma.asset.create({ data: { name: 'Laptop', assetTag: 'TAG-1' } });

    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');

    const buf = Buffer.from(await res.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['ครุภัณฑ์', 'ประวัติการเบิก-คืน']);

    const sheet1 = XLSX.utils.sheet_to_json(wb.Sheets['ครุภัณฑ์']);
    expect(sheet1).toHaveLength(1);
  });

  it('excludes soft-deleted assets from the export', async () => {
    await loginAsNewUser('MANAGER');
    await prisma.asset.create({ data: { name: 'Active' } });
    await prisma.asset.create({ data: { name: 'Deleted', isActive: false } });

    const res = await GET(req());
    const buf = Buffer.from(await res.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet1 = XLSX.utils.sheet_to_json(wb.Sheets['ครุภัณฑ์']);
    expect(sheet1).toHaveLength(1);
  });
});
