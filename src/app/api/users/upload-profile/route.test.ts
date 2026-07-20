import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { POST } from './route';
import { setupTestDatabase } from '@tests/helpers/with-test-db';
import { loginAsNewUser, createTestUser } from '@tests/helpers/auth';
import { prisma } from '@/lib/prisma';

// Avoid writing real files into the repo's public/uploads/profiles during tests.
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

setupTestDatabase();

function reqWithFile(userId: string, opts?: { type?: string; size?: number }) {
  const type = opts?.type ?? 'image/png';
  const size = opts?.size ?? 1024;
  const formData = new FormData();
  formData.append('file', new File([new Uint8Array(size)], 'avatar.png', { type }));
  formData.append('userId', userId);
  return new NextRequest('http://localhost:3000/api/users/upload-profile', { method: 'POST', body: formData });
}

describe('POST /api/users/upload-profile', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await POST(reqWithFile('1'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when file or userId is missing', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await POST(new NextRequest('http://localhost:3000/api/users/upload-profile', { method: 'POST', body: new FormData() }));
    expect(res.status).toBe(400);
  });

  it('returns 403 when a non-admin uploads for someone else', async () => {
    await loginAsNewUser('EMPLOYEE');
    const other = await createTestUser('EMPLOYEE');
    const res = await POST(reqWithFile(String(other.id)));
    expect(res.status).toBe(403);
  });

  it('lets a non-admin upload their own profile image', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const res = await POST(reqWithFile(String(user.id)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.profileImage).toMatch(/^\/uploads\/profiles\//);
    expect(vi.mocked(writeFile)).toHaveBeenCalledOnce();
    expect(vi.mocked(mkdir)).toHaveBeenCalledOnce();
  });

  it('returns 400 INVALID_FILE_TYPE for a disallowed mime type', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const res = await POST(reqWithFile(String(user.id), { type: 'application/pdf' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_FILE_TYPE');
  });

  it('returns 400 FILE_TOO_LARGE for files over 5MB', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const res = await POST(reqWithFile(String(user.id), { size: 6 * 1024 * 1024 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('FILE_TOO_LARGE');
  });

  it('an admin can upload a profile image for another user, updating the DB', async () => {
    await loginAsNewUser('ADMIN');
    const target = await createTestUser('EMPLOYEE');
    const res = await POST(reqWithFile(String(target.id)));
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(updated.profileImage).toMatch(/^\/uploads\/profiles\//);
  });
});
