import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH, DELETE } from './route';
import { setupTestDatabase } from '@tests/helpers/with-test-db';
import { loginAsNewUser } from '@tests/helpers/auth';
import { prisma } from '@/lib/prisma';

setupTestDatabase();

function req(method: string, body?: unknown) {
  return new NextRequest('http://localhost:3000/api/tasks/1', {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function createTask(assigneeId: number, columnId: number) {
  return prisma.task.create({ data: { title: 'Task', priority: 'LOW', columnId, assigneeId } });
}

describe('PATCH /api/tasks/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await PATCH(req('PATCH', { title: 'x' }), params('1'));
    expect(res.status).toBe(401);
  });

  it('returns 400 for a non-numeric id', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await PATCH(req('PATCH', { title: 'x' }), params('abc'));
    expect(res.status).toBe(400);
  });

  it('returns 404 for a nonexistent task', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await PATCH(req('PATCH', { title: 'x' }), params('999999'));
    expect(res.status).toBe(404);
  });

  it('updates the title', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const column = await prisma.kanbanColumn.findFirstOrThrow();
    const task = await createTask(user.id, column.id);

    const res = await PATCH(req('PATCH', { title: 'Renamed' }), params(String(task.id)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe('Renamed');
  });

  it('returns 404 COLUMN_NOT_FOUND when moving to a nonexistent column', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const column = await prisma.kanbanColumn.findFirstOrThrow();
    const task = await createTask(user.id, column.id);

    const res = await PATCH(req('PATCH', { columnId: 999999 }), params(String(task.id)));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('COLUMN_NOT_FOUND');
  });

  it('returns 400 for an invalid priority', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const column = await prisma.kanbanColumn.findFirstOrThrow();
    const task = await createTask(user.id, column.id);

    const res = await PATCH(req('PATCH', { priority: 'CRITICAL' }), params(String(task.id)));
    expect(res.status).toBe(400);
  });

  it('returns 404 ASSIGNEE_NOT_FOUND for a nonexistent assignee', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const column = await prisma.kanbanColumn.findFirstOrThrow();
    const task = await createTask(user.id, column.id);

    const res = await PATCH(req('PATCH', { assigneeId: 999999 }), params(String(task.id)));
    expect(res.status).toBe(404);
  });

  it('clears the assignee when assigneeId is explicitly null', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const column = await prisma.kanbanColumn.findFirstOrThrow();
    const task = await createTask(user.id, column.id);

    const res = await PATCH(req('PATCH', { assigneeId: null }), params(String(task.id)));
    const body = await res.json();
    expect(body.data.assigneeId).toBeNull();
  });

  it('recomputes reminder schedule fields when reminderAt changes, and resets sent flags', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const column = await prisma.kanbanColumn.findFirstOrThrow();
    const task = await prisma.task.create({
      data: {
        title: 'Task', priority: 'LOW', columnId: column.id, assigneeId: user.id,
        reminderAt: new Date('2026-07-01T12:00:00'),
        reminderSentAt: new Date(),
      },
    });

    const res = await PATCH(req('PATCH', { reminderAt: '2026-07-22T12:40:00' }), params(String(task.id)));
    const body = await res.json();
    expect(new Date(body.data.reminderOnDayAt).getDate()).toBe(22);
    expect(body.data.reminderSentAt).toBeNull();
  });

  it('clears reminder fields when reminderAt is set to null', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const column = await prisma.kanbanColumn.findFirstOrThrow();
    const task = await prisma.task.create({
      data: { title: 'Task', priority: 'LOW', columnId: column.id, assigneeId: user.id, reminderAt: new Date() },
    });

    const res = await PATCH(req('PATCH', { reminderAt: null }), params(String(task.id)));
    const body = await res.json();
    expect(body.data.reminderAt).toBeNull();
    expect(body.data.reminderDayBeforeAt).toBeNull();
  });
});

describe('DELETE /api/tasks/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await DELETE(req('DELETE'), params('1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 for a nonexistent task', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await DELETE(req('DELETE'), params('999999'));
    expect(res.status).toBe(404);
  });

  it('deletes the task', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const column = await prisma.kanbanColumn.findFirstOrThrow();
    const task = await createTask(user.id, column.id);

    const res = await DELETE(req('DELETE'), params(String(task.id)));
    expect(res.status).toBe(200);
    expect(await prisma.task.findUnique({ where: { id: task.id } })).toBeNull();
  });
});
