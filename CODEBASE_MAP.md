# CODEBASE MAP — EMS Admin (ems-trd-dtc)

> Generated: 2026-06-06  
> Purpose: Context reference for feature development

---

## 1. Project Overview

**Employee Management System (EMS)** — a Thai government-context internal HR tool built as a Next.js 16 fullstack application. Deployed on Synology NAS with MariaDB. All UI is in Thai.

Core modules:
- **Authentication** — custom session-based auth with DB-backed brute-force protection
- **Employees** — CRUD, profile images, import from CSV
- **Leaves** — Thai-gov–style leave requests, PDF generation, fiscal-year statistics
- **Kanban Tasks** — draggable column board with assignees and reminders
- **Supplies (พัสดุ)** — STOCK/NON_STOCK inventory, transaction history (receive/return/adjust), Excel export
- **Assets (ครุภัณฑ์)** — asset registry, checkout/return tracking, inspection records, Excel export
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
| Excel | ExcelJS 4 (supplies export), xlsx 0.18 (assets export) |
| ORM | Prisma 5 |
| Database | MariaDB 10.11 (Docker on Synology NAS) |
| Validation | Zod 3 |
| Auth | Custom session tokens (bcryptjs + HttpOnly cookie) |
| File Upload | Magic-byte MIME detection via `file-type` |
| Build | pnpm, tsx (seed/scripts), Turbopack (dev) |

---

## 3. Directory Tree

```
ems-trd-dtc/
├── .env                          # DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
├── .gitignore                    # Excludes .claude/, backups/, .env, node_modules, etc.
├── next.config.js                # Security headers (HSTS, CSP, etc.), canvas alias
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.seed.json
├── docker-compose.yml            # MariaDB 10.11 + phpMyAdmin (optional profile)
├── empty-module.js               # Canvas alias for @react-pdf/renderer
├── package.json
│
├── prisma/
│   ├── schema.prisma             # All DB models + enums (see §5)
│   ├── seed.ts
│   └── migrations/               # Historical migrations (pre-supplies/assets)
│
├── scripts/
│   └── backup.ts                 # DB backup utility
│
├── public/
│   └── uploads/
│       └── documents/            # Uploaded PDFs and images (gitignored)
│
└── src/
    ├── proxy.ts                  # HTTPS redirect, CORS helper
    ├── types/
    │   └── index.ts              # All TypeScript interfaces and types (see §6)
    │
    ├── lib/
    │   ├── prisma.ts             # Prisma client singleton
    │   ├── auth.ts               # requireAuth, checkRole, isAdmin, isManagerOrAbove
    │   ├── security.ts           # hashPassword, Zod schemas, sanitizeInput, generateSecureToken
    │   ├── rate-limit-db.ts      # DB-backed rate limiter (DatabaseRateLimiter)
    │   ├── logger.ts             # Structured logger (dev: pretty, prod: JSON)
    │   └── utils.ts              # cn(), formatDate, toBuddhistYear, etc.
    │
    ├── components/
    │   └── leaves/
    │       ├── LeaveForm.tsx
    │       ├── LeaveFormPDF.tsx
    │       └── pdf-fonts.ts
    │
    └── app/
        ├── globals.css
        ├── layout.tsx
        ├── page.tsx              # Login page (/)
        │
        ├── dashboard/
        │   ├── layout.tsx        # Sidebar + Header shell
        │   ├── page.tsx          # Dashboard — leave stats + summary
        │   ├── employees/page.tsx
        │   ├── leaves/page.tsx
        │   ├── tasks/page.tsx    # Kanban board
        │   ├── supplies/page.tsx # พัสดุ — inventory, transactions, export
        │   └── assets/page.tsx   # ครุภัณฑ์ — registry, checkout, inspection, export
        │
        └── api/
            ├── auth/
            │   ├── login/route.ts
            │   ├── logout/route.ts
            │   └── session/route.ts
            ├── users/
            │   ├── route.ts
            │   ├── [id]/route.ts
            │   ├── import/route.ts
            │   └── upload-profile/route.ts
            ├── leaves/
            │   ├── route.ts
            │   ├── [id]/route.ts
            │   ├── dashboard/route.ts
            │   ├── export/route.ts
            │   ├── search/route.ts
            │   └── statistics/route.ts
            ├── tasks/
            │   ├── route.ts
            │   └── [id]/route.ts
            ├── columns/
            │   ├── route.ts
            │   ├── [id]/route.ts
            │   └── reorder/route.ts
            ├── dashboard/
            │   ├── route.ts
            │   └── leave-stats/route.ts
            ├── supplies/
            │   ├── route.ts           # GET list / POST create
            │   ├── [id]/route.ts      # GET / PATCH / DELETE
            │   ├── export/route.ts    # GET — Excel (2–3 sheets, split by type)
            │   └── merge/route.ts     # POST — merge duplicate supplies
            ├── supply-categories/route.ts
            ├── supply-transactions/route.ts  # GET list / POST (receive/return/adjust)
            ├── assets/
            │   ├── route.ts           # GET list / POST create
            │   ├── [id]/route.ts      # GET / PATCH / DELETE
            │   └── export/route.ts    # GET — Excel (assets + checkout history sheets)
            ├── asset-categories/route.ts
            ├── asset-checkouts/
            │   ├── route.ts           # GET list / POST checkout
            │   └── [id]/route.ts      # PATCH return
            ├── uploads/
            │   └── document/route.ts  # POST — file upload (magic-byte MIME check)
            ├── departments/route.ts
            ├── positions/route.ts
            ├── position-seconds/route.ts
            ├── holidays/route.ts
            ├── leave-rules/route.ts
            └── health/route.ts
```

---

## 4. Module Dependency Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   Browser / Client                       │
│  page.tsx (login) → dashboard/layout.tsx                 │
│      ├── dashboard/page.tsx                              │
│      ├── employees/page.tsx                              │
│      ├── leaves/page.tsx ──► LeaveForm.tsx               │
│      ├── tasks/page.tsx                                  │
│      ├── supplies/page.tsx   (inventory + transactions)  │
│      └── assets/page.tsx     (registry + checkout)       │
└──────────────────┬──────────────────────────────────────┘
                   │ fetch()
                   ▼
┌──────────────────────────────────────────────────────────┐
│                  Next.js API Routes                       │
│                                                          │
│  /api/auth/*    /api/users/*    /api/leaves/*            │
│  /api/tasks/*   /api/columns/*  /api/dashboard/*         │
│  /api/supplies/* /api/supply-categories                  │
│  /api/supply-transactions                                │
│  /api/assets/*  /api/asset-categories                    │
│  /api/asset-checkouts/*  /api/uploads/document           │
│  /api/departments  /api/positions  /api/holidays         │
│  /api/leave-rules  /api/health                           │
│                                                          │
│  All routes use:                                         │
│    lib/auth.ts ───────────────────────────────────┐      │
│    lib/security.ts (Zod schemas, sanitize) ───────┤      │
│    lib/rate-limit-db.ts (login route only) ───────┤      │
│    lib/logger.ts ─────────────────────────────────┤      │
│    lib/utils.ts (helpers) ────────────────────────┘      │
└──────────────────┬───────────────────────────────────────┘
                   │ Prisma Client
                   ▼
┌──────────────────────────────────────────────────────────┐
│  lib/prisma.ts (singleton)                                │
│        │                                                 │
│        ▼                                                 │
│  MariaDB 10.11 (Docker / Synology NAS)                   │
│    tables: users, sessions, login_attempts,               │
│            tasks, kanban_columns,                         │
│            leaves, leave_rules,                           │
│            departments, positions, position_seconds,      │
│            holidays,                                      │
│            supply_categories, supplies,                   │
│            supply_transactions,                           │
│            asset_categories, assets, asset_checkouts      │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Database Models & Enums

### Enums

| Enum | Values |
|---|---|
| **Role** | SUPER_ADMIN, ADMIN, MANAGER, HR, EMPLOYEE |
| **Priority** | LOW, MEDIUM, HIGH, URGENT |
| **LeaveType** | SICK, PERSONAL, VACATION, MATERNITY, ORDINATION, EARLY_LEAVE, OTHER |
| **LeaveStatus** | PENDING, APPROVED, REJECTED |
| **SupplyType** | STOCK, NON_STOCK |
| **TransactionType** | RECEIVE, ISSUE, RETURN, ADJUST |
| **AssetStatus** | AVAILABLE, IN_USE, IN_REPAIR, RETURNED, DISPOSED |
| **AssetCondition** | EXCELLENT, GOOD, FAIR, POOR, DAMAGED |

### Models

| Model | Key Fields | Relations |
|---|---|---|
| **User** | id, email, username, password, prefix, name, role, department, division, position, positionSecond, positionLevel, phone, birthday, address, avatar, profileImage, isActive | → tasks, leaves, sessions, loginAttempts, supplyTransactions, checkoutsHeld, checkoutsIssued, assetsHeld |
| **Session** | id, userId, token (unique), expiresAt, ipAddress, userAgent, isValid | → User |
| **LoginAttempt** | id, userId?, username, ipAddress, success, reason | → User? |
| **KanbanColumn** | id, name, color, order, isDefault | → tasks |
| **Task** | id, title, description, columnId, priority, assigneeId, reminderAt, archivedAt | → KanbanColumn, User? |
| **Leave** | id, userId, type, startDate, endDate, reason, status, approvedBy, approvedAt, isHalfDay, hours, totalDays, contactAddress | → User |
| **LeaveRule** | id, name, startTime, endTime, fullDayHours, halfDayHours, maxConsecutiveDays, isActive | — |
| **Department** | id, name, description, isActive, order | — |
| **Position** | id, name, description, isActive, order | — |
| **PositionSecond** | id, name, hasLevel, maxLevel, isActive, order | — |
| **Holiday** | id, date (unique), name, description, year, isActive | — |
| **SupplyCategory** | id, name, description, isActive, order | → supplies |
| **Supply** | id, name, type (STOCK/NON_STOCK), categoryId, supplyCode, unit, currentQuantity, minimumQuantity, maximumQuantity, thresholdRed, thresholdYellow, supplier, unitPrice, documentNumber, documentUrl, imageUrl, issueDate, recorderName, notes, isActive | → category, transactions |
| **SupplyTransaction** | id, supplyId, type, quantity, quantityBefore, quantityAfter, documentNumber, documentUrl, recipientName, returnerName, returnReceiverName, adjusterName, notes, performedById | → supply, performedBy |
| **AssetCategory** | id, name, description, isActive, order | → assets |
| **Asset** | id, name, assetTag (unique), serialNumber, model, brand, categoryId, status, condition, currentHolderId, acquisitionDate, acquisitionCost, documentNumber, documentUrl, location, department, imageUrl, notes, isActive, receiverName, lastInspectionDate, lastInspectionCondition, lastInspectedBy | → category, currentHolder, checkouts |
| **AssetCheckout** | id, assetId, holderId, issuedById, checkedOutAt, returnedAt, expectedReturnAt, notes | → asset, holder, issuedBy |

---

## 6. TypeScript Types (`src/types/index.ts`)

### User & Auth
`UserRole`, `User`, `Department`, `Position`, `PositionSecond`, `SessionUser`, `CreateUserInput`, `UpdateUserInput`, `LoginInput`, `LoginResponse`, `ChangePasswordInput`

### Tasks
`TaskPriority`, `KanbanColumn`, `Task`, `CreateTaskInput`, `UpdateTaskInput`

### Leaves
`LeaveType`, `LeaveStatus`, `Leave`, `CreateLeaveInput`, `UpdateLeaveInput`

### Supplies *(added 2026-06)*
`SupplyType`, `TransactionType`, `SupplyCategory`, `Supply`, `SupplyTransaction`, `CreateSupplyInput`, `CreateTransactionInput`

### Assets *(added 2026-06)*
`AssetStatus`, `AssetCondition`, `AssetCategory`, `Asset`, `AssetCheckout`, `CreateAssetInput`, `CreateCheckoutInput`

### API & UI Utilities
`ApiResponse<T>`, `ApiError`, `DashboardStats`, `RecentActivity`, `ChildrenProps`, `ModalProps`, `FormStatus`, `FormErrors`, `FormState<T>`

---

## 7. Zod Schemas (`src/lib/security.ts`)

| Schema | Validates |
|---|---|
| `loginSchema` | username (alphanum+_, 3-100), password (8-128) |
| `createUserSchema` | email, username, password (upper+lower+digit), prefix, name, role, department |
| `createTaskSchema` | title (1-255), description (max 1000), priority enum, columnId, assigneeId |
| `createLeaveSchema` | type enum, startDate/endDate (YYYY-MM-DD), reason (1-500), isHalfDay, hours, contactAddress; endDate ≥ startDate |
| `createSupplyCategorySchema` | name (1-100), description (max 255), order int |
| `createSupplySchema` | name, type enum, categoryId, supplyCode, unit, quantities, thresholds (1-99%), supplier, dates, unitPrice, documentNumber, imageUrl, notes |
| `createTransactionSchema` | supplyId, type enum, quantity (positive int), documentNumber, recipientName, returnerName, returnReceiverName, adjusterName, notes |
| `createAssetCategorySchema` | name (1-100), description, order |
| `createAssetSchema` | name, assetTag, serialNumber, model, brand, categoryId, status/condition enums, acquisitionDate (YYYY-MM-DD), documentNumber, location, department, imageUrl, notes, receiverName, lastInspectionDate, lastInspectionCondition, lastInspectedBy |
| `createCheckoutSchema` | assetId, holderId, issuedById (optional override), expectedReturnAt, notes |

**Security utilities:** `hashPassword`, `verifyPassword`, `sanitizeInput`, `generateSecureToken` (uses `crypto.randomBytes`), `generateAvatarInitials`

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

Rate limiting: DatabaseRateLimiter (rate-limit-db.ts)
  – counts failed loginAttempts by IP in last 30 min
  – blocks at 5 failures
  – clears on successful login

Password: bcryptjs, 12 salt rounds

Session tokens: crypto.randomBytes() — cryptographically secure CSPRNG

Input validation: Zod schemas (security.ts) on all write endpoints

File uploads: magic-byte MIME detection via `file-type` package
  – rejects spoofed MIME types regardless of Content-Type header
  – allowed: PDF (10 MB), JPEG/PNG/WebP (5 MB)

XSS: sanitizeInput() — HTML entity encoding
SQL injection: parameterized queries via Prisma — no raw SQL

Role field protection: non-admin users cannot update position, department,
  division, positionLevel via PATCH /api/users/[id]
```

---

## 9. Role-Based Access Control

| Action | EMPLOYEE | HR | MANAGER | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|---|
| View own leaves | ✓ | ✓ | ✓ | ✓ | ✓ |
| View all leaves | ✗ | ✓ | ✓ | ✓ | ✓ |
| Approve leaves | ✗ | ✗ | ✓ | ✓ | ✓ |
| Manage users | ✗ | ✗ | ✗ | ✓ | ✓ |
| Manage supplies & assets | ✗ | ✗ | ✓ | ✓ | ✓ |
| Export reports | ✗ | ✗ | ✓ | ✓ | ✓ |
| Edit org fields (position/dept) | ✗ | ✗ | ✗ | ✓ | ✓ |

Helper functions in `lib/auth.ts`:
- `isAdmin(role)` — ADMIN or SUPER_ADMIN
- `isManagerOrAbove(role)` — MANAGER, ADMIN, SUPER_ADMIN
- `checkRole(role, allowedRoles[])` — generic check

---

## 10. Key Data Flows

### Supply Transaction Flow
```
[Supplies Page]
  │ POST /api/supply-transactions {supplyId, type, quantity, ...}
  ▼
[API] requireAuth → isManagerOrAbove → createTransactionSchema.safeParse
  │ prisma.$transaction:
  │   supply.findUnique → check quantity sufficient (for ISSUE)
  │   supply.update({currentQuantity: newQty})
  │   supplyTransaction.create({...})
  ▼
[DB] supply.currentQuantity updated; supply_transactions row created
  │
  │ GET /api/supplies/export?type=all&period=month
  ▼
[API] ExcelJS workbook:
  Sheet 1: คงคลัง (STOCK)
  Sheet 2: ไม่คงคลัง (NON_STOCK)   ← only when type=all
  Sheet 3: ประวัติการเบิก-รับ
  Sheet 4: สินค้าใกล้หมด
```

### Asset Checkout Flow
```
[Assets Page]
  │ POST /api/asset-checkouts {assetId, holderId, issuedById?, ...}
  ▼
[API] requireAuth → isManagerOrAbove → createCheckoutSchema.safeParse
  │ prisma.$transaction:
  │   asset.findUnique → check status === AVAILABLE
  │   user.findUnique(holderId) → check isActive
  │   assetCheckout.create({issuedById: override ?? authUser.id})
  │   asset.update({status: IN_USE, currentHolderId: holderId})
  ▼
[DB] asset.status = IN_USE; asset_checkouts row created
  │
  │ PATCH /api/asset-checkouts/[id] → return asset
  ▼
[DB] assetCheckout.returnedAt = now; asset.status = AVAILABLE
```

### Authentication Flow
```
[Login Page]
  │ POST /api/auth/login {username, password}
  ▼
[API] Zod validate → dbRateLimit.isRateLimited(ip)
  │ user.findUnique({username}) → bcrypt.compare(password, hash)
  │ session.create({token: crypto.randomBytes(), expiresAt: +24h})
  │ Set HttpOnly cookie: session_token
  ▼
[Client] cookie stored → router.push('/dashboard')
  │ All subsequent calls: cookie sent automatically
  ▼
[API] requireAuth(request) → session.findUnique({token})
  │ checks: session.isValid, expiresAt, user.isActive
  ▼
returns SessionUser { id, email, username, name, role, avatar }
```

---

## 11. Config & Environment

### `.env` (required variables)
```
DATABASE_URL=mysql://user:pass@host:3306/ems_db
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development|production
COOKIE_SAMESITE=strict|lax|none   (optional)
```

### `next.config.js`
- Security headers: HSTS (2yr), X-Frame-Options, X-Content-Type-Options, XSS-Protection, Referrer-Policy, CSP
- Turbopack + webpack `canvas: false` alias
- `poweredByHeader: false`

### `docker-compose.yml`
- `mariadb` service: MariaDB 10.11, utf8mb4, 256M InnoDB buffer — port 3306
- `phpmyadmin` service: optional `--profile admin` — port 8080

---

## 12. Dependencies

### Production
| Package | Version | Purpose |
|---|---|---|
| next | ^16.0.0 | Framework |
| react / react-dom | ^19.0.0 | UI |
| prisma / @prisma/client | ^5.7.0 | ORM |
| zod | ^3.22.4 | Validation |
| bcryptjs | ^2.4.3 | Password hashing |
| exceljs | ^4.4.0 | Supplies Excel export (styled) |
| xlsx | ^0.18.5 | Assets Excel export |
| file-type | ^22.0.1 | Server-side MIME detection for uploads |
| @react-pdf/renderer | ^4.3.2 | Leave PDF generation |
| recharts | ^3.7.0 | Dashboard charts |
| lucide-react | ^0.563.0 | Icons |
| tailwind-merge / clsx | ^2.2.0 / ^2.0.0 | Class utilities |
| @radix-ui/* | various | Accessible UI primitives |
| isomorphic-dompurify | ^2.0.0 | XSS sanitization |

### Dev
| Package | Version |
|---|---|
| typescript | ^5.9.3 |
| tailwindcss | ^3.4.0 |
| prisma (CLI) | ^5.7.0 |
| tsx | ^4.7.0 |
| @types/node, react, bcryptjs | various |

---

## 13. Technical Debt & Known Issues

| Location | Issue | Severity |
|---|---|---|
| `next.config.js:44` | CSP includes `'unsafe-inline'` and `'unsafe-eval'` — weakens XSS protection. Requires nonce-based CSP or isolating the library that needs eval. | High |
| `src/lib/security.ts` | `containsSqlInjection()` function exists but is never called in any API route — dead code. Remove or wire up. | Low |
| `src/proxy.ts:27` | CORS allows wildcard in dev — should specify explicit domain for production. | Medium |
| All GET supply/asset routes | No `isManagerOrAbove` check — EMPLOYEE role can enumerate all supplies, transactions, and asset checkouts. | Medium |
| No test files | Zero unit/integration tests across the entire codebase. | High |
| Session cleanup | Expired sessions accumulate in DB — no cron job to prune `sessions` table. | Medium |
| `LeaveForm.tsx` | Fiscal year calc (Oct 1–Sep 30) duplicated in `leave-stats` API. Should be a shared utility. | Low |
| `src/lib/logger.ts` | Production JSON logs have no rotation/shipping configured. | Low |

---

## 14. Build & Development Commands

```bash
pnpm dev          # Start dev server (Turbopack)
pnpm build        # Production build
pnpm start        # Start prod server (0.0.0.0:3000)
pnpm lint         # ESLint

pnpm db:generate  # Regenerate Prisma client after schema changes
pnpm db:migrate   # Run pending migrations (dev)
pnpm db:studio    # Open Prisma Studio
pnpm db:seed      # Run seed

npx prisma db push  # Sync schema to DB without migration (used for new fields)

docker-compose up -d              # Start MariaDB
docker-compose --profile admin up # + phpMyAdmin on :8080
```

---

## 15. Suggested Next Features

### Audit Log
- Add `AuditLog` model (entity, action, userId, changes JSON, createdAt)
- Wire into user/supply/asset mutations
- New admin page: `/dashboard/audit`

### Notifications / Reminders
- `Notification` model (userId, message, isRead, createdAt)
- Hook into leave approve/reject and asset overdue returns
- Client: polling or Server-Sent Events

### Leave Balance Tracking
- Extend `User` or add `LeaveBalance` model
- New API: `GET /api/leaves/balance?userId=`

### Password Reset
- `PasswordResetToken` model
- APIs: `POST /api/auth/reset-request`, `POST /api/auth/reset-confirm`
- Email via nodemailer or Resend

### Kanban Enhancements
- Archive view (Task already has `archivedAt`)
- Due dates and labels (extend Task with `dueDate`, `labels`)

### Supply/Asset Enhancements
- QR code generation for asset tags
- Scheduled inspection reminders
- Low-stock email alerts for STOCK supplies
