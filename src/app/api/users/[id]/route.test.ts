import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH, DELETE } from './route';
import { setupTestDatabase } from '@tests/helpers/with-test-db';
import { loginAsNewUser, createTestUser } from '@tests/helpers/auth';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/security';

setupTestDatabase();

function req(method: string, body?: unknown) {
  return new NextRequest('http://localhost:3000/api/users/1', {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/users/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await GET(req('GET'), params('1'));
    expect(res.status).toBe(401);
  });

  it('returns 400 for a non-numeric id', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await GET(req('GET'), params('abc'));
    expect(res.status).toBe(400);
  });

  it('returns 404 for a nonexistent user', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await GET(req('GET'), params('999999'));
    expect(res.status).toBe(404);
  });

  it('returns the user without a password field', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const res = await GET(req('GET'), params(String(user.id)));
    const body = await res.json();
    expect(body.data.id).toBe(user.id);
    expect(body.data.password).toBeUndefined();
  });
});

describe('PATCH /api/users/[id]', () => {
  it('returns 403 when a non-admin tries to edit someone else', async () => {
    await loginAsNewUser('EMPLOYEE');
    const other = await createTestUser('EMPLOYEE');
    const res = await PATCH(req('PATCH', { name: 'x' }), params(String(other.id)));
    expect(res.status).toBe(403);
  });

  it('lets a non-admin edit their own name', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const res = await PATCH(req('PATCH', { name: 'Updated Name' }), params(String(user.id)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe('Updated Name');
  });

  it('silently ignores role/isActive changes from a non-admin editing themselves', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const res = await PATCH(req('PATCH', { role: 'SUPER_ADMIN', isActive: false }), params(String(user.id)));
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.role).toBe('EMPLOYEE');
    expect(updated.isActive).toBe(true);
  });

  it('lets an admin change role/isActive for another user', async () => {
    await loginAsNewUser('ADMIN');
    const other = await createTestUser('EMPLOYEE');
    const res = await PATCH(req('PATCH', { role: 'MANAGER', isActive: false }), params(String(other.id)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.role).toBe('MANAGER');
    expect(body.data.isActive).toBe(false);
  });

  it('returns 409 EMAIL_EXISTS when changing to an email already in use', async () => {
    await loginAsNewUser('ADMIN');
    await createTestUser('EMPLOYEE', { email: 'taken@example.test' });
    const target = await createTestUser('EMPLOYEE');
    const res = await PATCH(req('PATCH', { email: 'taken@example.test' }), params(String(target.id)));
    expect(res.status).toBe(409);
  });

  it('hashes a new password when provided', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const res = await PATCH(req('PATCH', { password: 'BrandNewPassword1' }), params(String(user.id)));
    expect(res.status).toBe(200);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword('BrandNewPassword1', updated.password)).toBe(true);
  });

  it('returns 404 for a nonexistent user (as admin)', async () => {
    await loginAsNewUser('ADMIN');
    const res = await PATCH(req('PATCH', { name: 'x' }), params('999999'));
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/users/[id]', () => {
  it('returns 403 for a non-admin', async () => {
    await loginAsNewUser('EMPLOYEE');
    const other = await createTestUser('EMPLOYEE');
    const res = await DELETE(req('DELETE'), params(String(other.id)));
    expect(res.status).toBe(403);
  });

  it('returns 400 CANNOT_DELETE_SELF', async () => {
    const admin = await loginAsNewUser('ADMIN');
    const res = await DELETE(req('DELETE'), params(String(admin.id)));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('CANNOT_DELETE_SELF');
  });

  it('returns 404 for a nonexistent user', async () => {
    await loginAsNewUser('ADMIN');
    const res = await DELETE(req('DELETE'), params('999999'));
    expect(res.status).toBe(404);
  });

  it('deletes the user as an admin', async () => {
    await loginAsNewUser('ADMIN');
    const target = await createTestUser('EMPLOYEE');
    const res = await DELETE(req('DELETE'), params(String(target.id)));
    expect(res.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: target.id } })).toBeNull();
  });
});
