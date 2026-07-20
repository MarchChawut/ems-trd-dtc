import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { setupTestDatabase } from '@tests/helpers/with-test-db';
import { loginAsNewUser } from '@tests/helpers/auth';
import { prisma } from '@/lib/prisma';

setupTestDatabase();

function req() {
  return new NextRequest('http://localhost:3000/api/files/some-id');
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/files/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await GET(req(), params('some-id'));
    expect(res.status).toBe(401);
  });

  it('returns 404 for a nonexistent file', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await GET(req(), params('nonexistent-id'));
    expect(res.status).toBe(404);
  });

  it('serves the file bytes with the correct content-type and disposition', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const data = Buffer.from('fake pdf content');
    const file = await prisma.uploadedFile.create({
      data: { data, mimeType: 'application/pdf', fileName: 'test.pdf', size: data.length, uploadedById: user.id },
    });

    const res = await GET(req(), params(file.id));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toContain('test.pdf');

    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.equals(data)).toBe(true);
  });
});
