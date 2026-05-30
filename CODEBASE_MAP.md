# CODEBASE MAP — EMS Admin (ems-trd-dtc)

> Generated: 2026-05-29  
> Purpose: Context reference for feature development

---

## 1. Project Overview

**Employee Management System (EMS)** — a Thai government-context internal HR tool built as a Next.js 16 fullstack application. Deployed on Synology NAS with MariaDB. All UI is in Thai.

Core modules:
- **Authentication** — custom session-based auth with brute-force protection
- **Employees** — CRUD, profile images, import from CSV
- **Leaves** — Thai-gov–style leave requests, PDF generation, fiscal-year statistics
- **Kanban Tasks** — draggable column board with assignees and reminders
- **Dashboard** — leave statistics with charts (Recharts), per-user summaries

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.9 |
| UI | React 19, Tailwind CSS 3.4, Radix UI primitives |
| Icons | lucide-react |
| Charts | Recharts 3 |
| PDF | @react-pdf/renderer 4 |
| ORM | Prisma 5 |
| Database | MariaDB 10.11 (Docker on Synology NAS) |
| Validation | Zod 3 |
| Auth | Custom session tokens (bcryptjs + cookie) |
| Build | pnpm, tsx (seed/scripts), Turbopack (dev) |

---

## 3. Directory Tree

```
ems-trd-dtc/
├── .env                          # DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
├── .gitignore
├── next.config.js                # Security headers (HSTS, CSP, etc.), canvas alias
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.seed.json            # Separate tsconfig for seed script
├── docker-compose.yml            # MariaDB 10.11 + phpMyAdmin (optional profile)
├── empty-module.js               # Canvas alias for @react-pdf/renderer
├── package.json
│
├── prisma/
│   ├── schema.prisma             # All DB models + enums (see §5)
│   ├── seed.ts                   # Initial data seeder
│   └── migrations/
│       ├── 20260204_init/
│       ├── 20260204_add_kanban_columns/
│       ├── 20260209_add_leave_features/
│       ├── 20260209_change_position/
│       ├── 20260211_add_task_reminder_archive/
│       ├── 20260403_add_phone_address_early_leave/
│       ├── 20260404_add_contact_address_to_leave/
│       └── 20260408_add_birthday_to_users/
│
├── scripts/
│   └── backup.ts                 # DB backup utility
│
├── dist-seed/                    # Compiled seed (JS) used by prisma seed command
│
├── public/                       # Static assets
│
└── src/
    ├── proxy.ts                  # Middleware-like proxy helper (HTTPS redirect, CORS)
    ├── types/
    │   └── index.ts              # All TypeScript interfaces and types
    │
    ├── lib/
    │   ├── prisma.ts             # Prisma client singleton (global in dev)
    │   ├── auth.ts               # requireAuth, checkRole, getCurrentUser, validateSession
    │   ├── security.ts           # hashPassword, verifyPassword, Zod schemas, sanitizeInput
    │   ├── rate-limit-db.ts      # DB-backed rate limiter (DatabaseRateLimiter class)
    │   ├── logger.ts             # Structured logger (dev: pretty, prod: JSON)
    │   └── utils.ts              # cn(), formatDate, toBuddhistYear, formatSignatureName, etc.
    │
    ├── components/
    │   └── leaves/
    │       ├── LeaveForm.tsx     # Thai-gov leave form (print view + PDF trigger)
    │       ├── LeaveFormPDF.tsx  # @react-pdf/renderer PDF layout
    │       └── pdf-fonts.ts      # Thai font registration for PDF
    │
    └── app/
        ├── globals.css
        ├── layout.tsx            # Root layout (Inter font, metadata, SEO blocked)
        ├── page.tsx              # Login page (/)
        │
        ├── dashboard/
        │   ├── layout.tsx        # Sidebar + Header shell (session check on mount)
        │   ├── page.tsx          # Main dashboard — leave stats charts + summary table
        │   ├── employees/
        │   │   └── page.tsx      # Employee list, CRUD modal, CSV import, profile image
        │   ├── leaves/
        │   │   └── page.tsx      # Leave requests table, approve/reject, PDF, CSV export
        │   └── tasks/
        │       └── page.tsx      # Kanban board with drag-and-drop columns
        │
        └── api/
            ├── auth/
            │   ├── login/route.ts     # POST — credential check, session creation, rate limit
            │   ├── logout/route.ts    # POST — invalidate session cookie
            │   └── session/route.ts   # GET — validate current session
            ├── users/
            │   ├── route.ts           # GET list / POST create
            │   ├── [id]/route.ts      # GET / PATCH / DELETE single user
            │   ├── import/route.ts    # POST — bulk CSV import
            │   └── upload-profile/route.ts  # POST — profile image upload
            ├── leaves/
            │   ├── route.ts           # GET list / POST create
            │   ├── [id]/route.ts      # GET / PATCH / DELETE single leave
            │   ├── dashboard/route.ts # GET — leave stats for employee view
            │   ├── export/route.ts    # GET — CSV export with column selection
            │   ├── search/route.ts    # GET — full-text search
            │   └── statistics/route.ts # GET — leave counts per type per user
            ├── tasks/
            │   ├── route.ts           # GET list / POST create
            │   └── [id]/route.ts      # GET / PATCH / DELETE single task
            ├── columns/
            │   ├── route.ts           # GET / POST kanban columns
            │   ├── [id]/route.ts      # PATCH / DELETE single column
            │   └── reorder/route.ts   # POST — reorder column positions
            ├── dashboard/
            │   ├── route.ts           # GET — aggregate stats (users, tasks, leaves)
            │   └── leave-stats/route.ts  # GET — fiscal-year leave breakdown
            ├── departments/route.ts   # GET / POST / PATCH / DELETE
            ├── positions/route.ts     # GET / POST / PATCH / DELETE
            ├── position-seconds/route.ts # GET / POST / PATCH / DELETE
            ├── holidays/route.ts      # GET / POST / PATCH / DELETE
            ├── leave-rules/route.ts   # GET / POST / PATCH active leave rules
            └── health/route.ts        # GET — health check
```

---

## 4. Module Dependency Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Browser / Client                   │
│  page.tsx (login) → dashboard/layout.tsx             │
│      ├── dashboard/page.tsx                          │
│      ├── employees/page.tsx                          │
│      ├── leaves/page.tsx ──► LeaveForm.tsx           │
│      │                           └── LeaveFormPDF.tsx│
│      │                               └── pdf-fonts.ts│
│      └── tasks/page.tsx                              │
└──────────────────┬──────────────────────────────────┘
                   │ fetch()
                   ▼
┌──────────────────────────────────────────────────────┐
│                  Next.js API Routes                   │
│                                                       │
│  /api/auth/*  /api/users/*  /api/leaves/*             │
│  /api/tasks/* /api/columns/* /api/dashboard/*         │
│  /api/departments  /api/positions  /api/holidays      │
│  /api/leave-rules  /api/health                        │
│                                                       │
│  All routes use:                                      │
│    lib/auth.ts ──────────────────────────────────┐    │
│    lib/security.ts (Zod schemas, sanitize) ──────┤    │
│    lib/rate-limit-db.ts (login route only) ──────┤    │
│    lib/logger.ts ────────────────────────────────┤    │
│    lib/utils.ts (helpers) ───────────────────────┘    │
└──────────────────┬───────────────────────────────────┘
                   │ Prisma Client
                   ▼
┌──────────────────────────────────────────────────────┐
│  lib/prisma.ts (singleton)                            │
│        │                                             │
│        ▼                                             │
│  MariaDB 10.11 (Docker / Synology NAS)               │
│    tables: users, sessions, login_attempts,           │
│            tasks, kanban_columns,                     │
│            leaves, leave_rules,                       │
│            departments, positions, position_seconds,  │
│            holidays                                   │
└──────────────────────────────────────────────────────┘

lib/auth.ts  depends on: prisma.ts, types/index.ts
lib/security.ts  depends on: bcryptjs, zod  (standalone)
lib/rate-limit-db.ts  depends on: prisma.ts, logger.ts
lib/utils.ts  depends on: clsx, tailwind-merge  (standalone)
LeaveForm.tsx  depends on: LeaveFormPDF.tsx, pdf-fonts.ts, lib/utils.ts, types/index.ts
```

---

## 5. Database Models & Enums

### Models

| Model | Key Fields | Relations |
|---|---|---|
| **User** | id, email, username, password, prefix, name, role, department, division, position, positionSecond, positionLevel, phone, birthday, address, avatar, profileImage, isActive | → tasks, leaves, sessions, loginAttempts |
| **Session** | id, userId, token (unique), expiresAt, ipAddress, isValid | → User |
| **LoginAttempt** | id, userId?, username, ipAddress, success, reason | → User? |
| **KanbanColumn** | id, name, color, order, isDefault | → tasks |
| **Task** | id, title, description, columnId, priority, assigneeId, reminderAt, archivedAt | → KanbanColumn, User? |
| **Leave** | id, userId, type, startDate, endDate, reason, status, isHalfDay, hours, totalDays, contactAddress | → User |
| **LeaveRule** | id, name, startTime, endTime, fullDayHours, halfDayHours, maxConsecutiveDays, isActive | — |
| **Department** | id, name, description, isActive, order | — |
| **Position** | id, name, description, isActive, order | — |
| **PositionSecond** | id, name, hasLevel, maxLevel, isActive, order | — |
| **Holiday** | id, date (unique), name, year, isActive | — |

### Enums

| Enum | Values |
|---|---|
| Role | SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE, HR |
| Priority | LOW, MEDIUM, HIGH, URGENT |
| LeaveType | SICK, PERSONAL, VACATION, MATERNITY, ORDINATION, EARLY_LEAVE, OTHER |
| LeaveStatus | PENDING, APPROVED, REJECTED |

---

## 6. Data Flow: DB → API → Frontend

### Authentication Flow
```
[Login Page]
  │ POST /api/auth/login {username, password}
  ▼
[API] Zod validate → dbRateLimit.isRateLimited(ip)
  │ prisma.user.findUnique({username})
  │ bcrypt.compare(password, hash)
  │ prisma.session.create({token, expiresAt})
  │ Set HttpOnly cookie: session_token
  ▼
[Client] cookie stored → router.push('/dashboard')
  │
  │ All subsequent API calls: cookie sent automatically
  ▼
[API] requireAuth(request) → prisma.session.findUnique({token})
  │ checks: session.isValid, expiresAt, user.isActive
  ▼
returns SessionUser { id, email, username, name, role, avatar }
```

### Leave Request Flow
```
[Leaves Page]
  │ POST /api/leaves {type, startDate, endDate, reason, ...}
  ▼
[API] requireAuth → createLeaveSchema.safeParse → sanitizeInput
  │ prisma.leave.create({userId: currentUser.id, ...})
  ▼
[DB] leaves table — status: PENDING
  │
  │ Manager/Admin: PATCH /api/leaves/[id] {status: APPROVED}
  ▼
[DB] leaves.status updated, approvedBy, approvedAt set
  │
  │ GET /api/leaves/export?columns=...&startDate=...
  ▼
[API] prisma.leave.findMany + CSV serialization → stream to browser
  │
  │ LeaveForm.tsx receives Leave + User data
  ▼
[PDF] generateLeavePDF() → @react-pdf/renderer → browser download
```

### Dashboard Stats Flow
```
[Dashboard Page]
  │ GET /api/dashboard  (summary counts)
  │ GET /api/dashboard/leave-stats?fiscalYear=...&type=...
  ▼
[API] /api/dashboard:
  │ prisma.user.count(), prisma.leave.count(), prisma.task.count()
  │ prisma.kanbanColumn.findMany({ include: { _count: tasks }})
  ▼
[API] /api/dashboard/leave-stats:
  │ Computes fiscal year range (Oct 1 – Sep 30)
  │ prisma.leave.findMany({where: {startDate: {gte, lte}, status: APPROVED}})
  │ Groups by user, by type, by month → returns chartData, userSummaries, leaves[]
  ▼
[Frontend] Recharts BarChart (horizontal, grouped by person)
  │ filteredLeaves memo (by selectedMonth)
  │ chartDataByPerson memo
  │ userTableData memo (sorted by totalDays desc)
```

---

## 7. Config Files & Environment Variables

### `.env` (required variables)
```
DATABASE_URL=mysql://user:pass@host:3306/ems_db
NEXTAUTH_SECRET=<random-secret>
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development|production
COOKIE_SAMESITE=strict|lax|none   (optional)
```

### `next.config.js`
- Security headers: HSTS, X-Frame-Options, CSP, nosniff, XSS-Protection
- Turbopack + webpack `canvas: false` alias (for @react-pdf/renderer)
- `poweredByHeader: false`

### `docker-compose.yml`
- `mariadb` service: MariaDB 10.11, utf8mb4, 256M InnoDB buffer
- `phpmyadmin` service: optional, activated with `--profile admin`
- Port: 3306 (DB), 8080 (phpMyAdmin)

### `tailwind.config.ts`
- Extended with `tailwindcss-animate` plugin

---

## 8. Authentication & Security Architecture

```
cookie: session_token (HttpOnly, Secure in prod, SameSite=strict)
         │
         ▼
Session table in DB (token unique, expiresAt, isValid)
         │
         ▼
requireAuth() — called in every protected API route
  checks: token exists → session valid → not expired → user.isActive

Rate limiting: DatabaseRateLimiter
  – counts failed loginAttempts by IP in last 30 min
  – blocks at 5 failures (MAX_LOGIN_ATTEMPTS)
  – clears on successful login

Password: bcryptjs, 12 salt rounds

Input validation: Zod schemas in security.ts
  – loginSchema, createUserSchema, createTaskSchema, createLeaveSchema

XSS: sanitizeInput() — HTML entity encoding
SQL injection: parameterized queries via Prisma (ORM) — no raw SQL
```

---

## 9. Role-Based Access Control

| Role | Can see own leaves | Can see all leaves | Approve leaves | Manage users | Admin |
|---|---|---|---|---|---|
| EMPLOYEE | ✓ | ✗ | ✗ | ✗ | ✗ |
| HR | ✓ | ✓ | ✗ | ✗ | ✗ |
| MANAGER | ✓ | ✓ | ✓ | ✗ | ✗ |
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ |
| SUPER_ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ |

Helper functions in `lib/auth.ts`:
- `isAdmin(role)` — ADMIN or SUPER_ADMIN
- `isManagerOrAbove(role)` — MANAGER, ADMIN, SUPER_ADMIN
- `checkRole(role, allowedRoles[])` — generic check

---

## 10. Technical Debt & Notable Issues

| Location | Issue | Severity |
|---|---|---|
| `src/lib/security.ts:196` | In-memory `loginAttempts` Map still exists alongside the DB-backed `rate-limit-db.ts`. The in-memory one is **unused** in API routes but still exported — dead code and confusing. | Low |
| `src/proxy.ts:27` | Comment says production should specify an explicit domain for CORS/HTTPS redirect. Currently allows wildcard. | Medium |
| `src/app/api/leaves/route.ts:49` | `where: any` — loose typing on Prisma where clause. Should be `Prisma.LeaveWhereInput`. | Low |
| No test files | Zero unit/integration tests across the entire codebase. | High |
| `src/lib/logger.ts` | Logger has a `production` branch that outputs JSON but no log rotation/shipping configured. | Low |
| `prisma/seed.ts` | Compiled to `dist-seed/` before use — adding a `prebuild` or `predev` script to auto-compile would reduce manual steps. | Low |
| Session cleanup | Expired sessions accumulate in DB — no cron job or cleanup route to prune them. | Medium |
| `LeaveForm.tsx` | Hard-codes fiscal year calc (Oct 1 – Sep 30) — same logic also in `leave-stats` API. Should be a shared utility. | Low |

---

## 11. Suggested Feature Placement

### Notifications / Reminders
- Add `Notification` model to Prisma (userId, message, isRead, createdAt)
- New API: `GET/POST /api/notifications`
- Hook into `/api/leaves/[id]` (on approve/reject) and `/api/tasks/[id]` (on reminderAt match)
- Client: polling or Server-Sent Events endpoint

### Leave Balance Tracking
- Extend `User` model with `leaveBalances` or a separate `LeaveBalance` model
- New API: `GET /api/leaves/balance?userId=`
- Display in `leaves/page.tsx` header and `LeaveForm.tsx`

### Reporting / Analytics Export
- Extend `GET /api/leaves/export` to support XLSX (add `xlsx` package)
- New: `GET /api/dashboard/report` that aggregates monthly trends
- New dashboard tab in `dashboard/layout.tsx` menuItems

### Employee Self-Service
- New page: `/dashboard/my-leaves` — employees see only their own leaves, request new ones
- Reuse `/api/leaves` (already role-scoped for EMPLOYEE role)

### Audit Log
- Add `AuditLog` model (entity, action, userId, changes JSON, createdAt)
- Wire into user/leave/task mutations in API routes
- New admin page: `/dashboard/audit`

### Password Reset
- Add `PasswordResetToken` model
- New API: `POST /api/auth/reset-request`, `POST /api/auth/reset-confirm`
- Email integration (nodemailer or Resend)

### Kanban Enhancements
- `Task` already has `reminderAt` and `archivedAt` — build an Archive view tab in `tasks/page.tsx`
- Add due dates and labels (extend Task model with `dueDate`, `labels String[]`)

---

## 12. Build & Development Commands

```bash
pnpm dev          # Start dev server (Turbopack)
pnpm build        # Production build
pnpm start        # Start prod server (0.0.0.0:3000)
pnpm lint         # ESLint

pnpm db:generate  # Regenerate Prisma client after schema changes
pnpm db:migrate   # Run pending migrations (dev)
pnpm db:studio    # Open Prisma Studio
pnpm db:seed      # Run seed (uses dist-seed/prisma/seed.js)

docker-compose up -d              # Start MariaDB
docker-compose --profile admin up # + phpMyAdmin on :8080
```
