import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT, PATCH, DELETE } from './route';
import { setupTestDatabase } from '@tests/helpers/with-test-db';
import { loginAsNewUser, createTestUser } from '@tests/helpers/auth';
import { prisma } from '@/lib/prisma';

setupTestDatabase();

function req(method: string, body?: unknown) {
  return new NextRequest('http://localhost:3000/api/leaves/1', {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function createLeave(userId: number, overrides: Partial<{ status: 'PENDING' | 'APPROVED' | 'REJECTED' }> = {}) {
  return prisma.leave.create({
    data: {
      userId,
      type: 'SICK',
      startDate: new Date('2026-07-06'),
      endDate: new Date('2026-07-06'),
      reason: 'reason',
      totalDays: 1,
      status: overrides.status ?? 'PENDING',
    },
  });
}

describe('PUT /api/leaves/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await PUT(req('PUT', {}), params('1'));
    expect(res.status).toBe(401);
  });

  it('returns 400 for a non-numeric id', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await PUT(req('PUT', {}), params('abc'));
    expect(res.status).toBe(400);
  });

  it('returns 404 for a nonexistent leave', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await PUT(
      req('PUT', { type: 'SICK', startDate: '2026-07-06', endDate: '2026-07-06', reason: 'x' }),
      params('999999')
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when a non-owner, non-manager tries to edit', async () => {
    const owner = await createTestUser('EMPLOYEE');
    await loginAsNewUser('EMPLOYEE');
    const leave = await createLeave(owner.id);

    const res = await PUT(
      req('PUT', { type: 'SICK', startDate: '2026-07-06', endDate: '2026-07-06', reason: 'x' }),
      params(String(leave.id))
    );
    expect(res.status).toBe(403);
  });

  it('lets the owner edit their own leave and recomputes totalDays', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const leave = await createLeave(user.id);

    const res = await PUT(
      req('PUT', { type: 'SICK', startDate: '2026-07-06', endDate: '2026-07-08', reason: 'updated' }),
      params(String(leave.id))
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.totalDays).toBe(3);
    expect(body.data.reason).toBe('updated');
  });

  it('lets a manager edit any leave', async () => {
    const owner = await createTestUser('EMPLOYEE');
    await loginAsNewUser('MANAGER');
    const leave = await createLeave(owner.id);

    const res = await PUT(
      req('PUT', { type: 'PERSONAL', startDate: '2026-07-06', endDate: '2026-07-06', reason: 'by manager' }),
      params(String(leave.id))
    );
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/leaves/[id] (approve/reject)', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await PATCH(req('PATCH', { status: 'APPROVED' }), params('1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-manager', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const leave = await createLeave(user.id);
    const res = await PATCH(req('PATCH', { status: 'APPROVED' }), params(String(leave.id)));
    expect(res.status).toBe(403);
  });

  it('returns 400 for an invalid status value', async () => {
    const employee = await createTestUser('EMPLOYEE');
    await loginAsNewUser('MANAGER');
    const leave = await createLeave(employee.id);
    const res = await PATCH(req('PATCH', { status: 'MAYBE' }), params(String(leave.id)));
    expect(res.status).toBe(400);
  });

  it('returns 400 ALREADY_PROCESSED for a non-pending leave', async () => {
    const employee = await createTestUser('EMPLOYEE');
    await loginAsNewUser('MANAGER');
    const leave = await createLeave(employee.id, { status: 'APPROVED' });
    const res = await PATCH(req('PATCH', { status: 'REJECTED' }), params(String(leave.id)));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ALREADY_PROCESSED');
  });

  it('approves a pending leave and records the approver', async () => {
    const employee = await createTestUser('EMPLOYEE');
    const manager = await loginAsNewUser('MANAGER');
    const leave = await createLeave(employee.id);

    const res = await PATCH(req('PATCH', { status: 'APPROVED' }), params(String(leave.id)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('APPROVED');
    expect(body.data.approvedBy).toBe(manager.id);
    expect(body.data.approvedAt).toBeDefined();
  });
});

describe('DELETE /api/leaves/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await DELETE(req('DELETE'), params('1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 for a nonexistent leave', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await DELETE(req('DELETE'), params('999999'));
    expect(res.status).toBe(404);
  });

  it('returns 403 when a non-owner, non-manager tries to delete', async () => {
    const owner = await createTestUser('EMPLOYEE');
    await loginAsNewUser('EMPLOYEE');
    const leave = await createLeave(owner.id);
    const res = await DELETE(req('DELETE'), params(String(leave.id)));
    expect(res.status).toBe(403);
  });

  it('lets the owner delete their own leave', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const leave = await createLeave(user.id);
    const res = await DELETE(req('DELETE'), params(String(leave.id)));
    expect(res.status).toBe(200);
    expect(await prisma.leave.findUnique({ where: { id: leave.id } })).toBeNull();
  });
});
