import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { setupTestDatabase } from '@tests/helpers/with-test-db';
import { loginAsNewUser } from '@tests/helpers/auth';
import { prisma } from '@/lib/prisma';

setupTestDatabase();

function req(url: string, init?: { method?: string; body?: unknown }) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: init?.method ?? 'GET',
    headers: init?.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

describe('GET /api/tasks', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await GET(req('/api/tasks'));
    expect(res.status).toBe(401);
  });

  it('returns an empty list when authenticated and no tasks exist', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await GET(req('/api/tasks'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('excludes archived tasks by default, includes them with showArchived=true', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const column = await prisma.kanbanColumn.findFirstOrThrow();

    await prisma.task.create({
      data: { title: 'Active task', priority: 'MEDIUM', columnId: column.id, assigneeId: user.id },
    });
    await prisma.task.create({
      data: {
        title: 'Archived task',
        priority: 'MEDIUM',
        columnId: column.id,
        assigneeId: user.id,
        archivedAt: new Date(),
      },
    });

    const defaultRes = await GET(req('/api/tasks'));
    const defaultBody = await defaultRes.json();
    expect(defaultBody.data).toHaveLength(1);
    expect(defaultBody.data[0].title).toBe('Active task');

    const allRes = await GET(req('/api/tasks?showArchived=true'));
    const allBody = await allRes.json();
    expect(allBody.data).toHaveLength(2);
  });

  it('filters by priority', async () => {
    const user = await loginAsNewUser('EMPLOYEE');
    const column = await prisma.kanbanColumn.findFirstOrThrow();

    await prisma.task.create({
      data: { title: 'Low', priority: 'LOW', columnId: column.id, assigneeId: user.id },
    });
    await prisma.task.create({
      data: { title: 'Urgent', priority: 'URGENT', columnId: column.id, assigneeId: user.id },
    });

    const res = await GET(req('/api/tasks?priority=URGENT'));
    const body = await res.json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Urgent');
  });
});

describe('POST /api/tasks', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await POST(req('/api/tasks', { method: 'POST', body: { title: 'x', priority: 'LOW' } }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid input (missing title)', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await POST(req('/api/tasks', { method: 'POST', body: { priority: 'LOW' } }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('creates a task and defaults to the first column when columnId is omitted', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await POST(
      req('/api/tasks', { method: 'POST', body: { title: 'New task', priority: 'HIGH' } })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('New task');
    expect(body.data.columnId).toBe(1);
  });

  it('returns 404 when assigneeId does not exist', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await POST(
      req('/api/tasks', { method: 'POST', body: { title: 'x', priority: 'LOW', assigneeId: 999999 } })
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('ASSIGNEE_NOT_FOUND');
  });

  it('auto-computes reminderDayBeforeAt/reminderOnDayAt from reminderAt', async () => {
    await loginAsNewUser('EMPLOYEE');
    const res = await POST(
      req('/api/tasks', {
        method: 'POST',
        body: { title: 'Reminder task', priority: 'MEDIUM', reminderAt: '2026-07-22T12:40:00' },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(new Date(body.data.reminderOnDayAt).getDate()).toBe(22);
    expect(new Date(body.data.reminderOnDayAt).getHours()).toBe(8);
    expect(new Date(body.data.reminderDayBeforeAt).getDate()).toBe(21);
    expect(new Date(body.data.reminderDayBeforeAt).getHours()).toBe(19);
  });
});
