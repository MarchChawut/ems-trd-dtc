# CODEBASE MAP — EMS Admin (ems-trd-dtc)

> Generated: 2026-06-06 · Last updated: 2026-07-15 (document register, LINE reminders, dashboard widget refactor, late-arrival leave form, DB-backed file storage)
> Purpose: Context reference for feature development

---

## 1. Project Overview

**Employee Management System (EMS)** — a Thai government-context internal HR tool built as a Next.js 16 fullstack application. Deployed on Synology NAS with MariaDB. All UI is in Thai.

Core modules:
- **Authentication** — custom session-based auth with DB-backed brute-force protection, **mandatory 2FA (TOTP)** on password login, and **passkey (WebAuthn) login** as an alternative
- **Employees** — CRUD, profile images, import from CSV
- **Leaves** — Thai-gov–style leave requests (incl. a dedicated late-arrival form), PDF generation, fiscal-year statistics
- **Kanban Tasks** — draggable column board with assignees and **LINE group reminders**
- **Supplies (พัสดุ)** — STOCK/NON_STOCK inventory, transaction history (receive/return/adjust), Excel export
- **Assets (ครุภัณฑ์)** — asset registry, checkout/return tracking, inspection records, Excel export
- **Document Register (ทะเบียนรับ-ส่งหนังสือ)** — incoming/outgoing document log with category tagging and Excel export
- **Dashboard** — leave statistics with charts (Recharts), plus widgets for pending approvals, recent tasks, low-stock supplies, and asset status/overdue checkouts

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
| Excel | ExcelJS 4 (supplies/documents export), xlsx 0.18 (assets export) |
| ORM | Prisma 5 |
| Database | MariaDB 10.11 (Docker on Synology NAS) |
| Validation | Zod 3 |
| Auth | Custom session tokens (bcryptjs + HttpOnly cookie) |
| 2FA | TOTP via `otplib` 13 + QR via `qrcode`; secret encrypted at rest (AES-256-GCM) |
| Passkey | WebAuthn via `@simplewebauthn/server` + `@simplewebauthn/browser` 13 |
| File Storage | Files stored as bytes in MariaDB (`UploadedFile`), served via `/api/files/[id]`; magic-byte MIME detection via `file-type` |
| Notifications | LINE Messaging API (group push) for task reminders |
| Build | pnpm, tsx (seed/scripts), Turbopack (dev) |

---

## 3. Directory Tree

```
ems-trd-dtc/
├── .env                          # DATABASE_URL, RP_ID/RP_NAME/WEBAUTHN_ORIGIN, TWO_FACTOR_ENC_KEY, LINE_*, CRON_SECRET, etc.
├── .gitignore                    # Excludes .claude/, backups/, .env, node_modules, etc.
├── next.config.js                # Security headers (HSTS, CSP, etc.), canvas alias
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.seed.json
├── docker-compose.yml            # MariaDB 10.11 + phpMyAdmin (optional profile)
├── empty-module.js               # Canvas alias for @react-pdf/renderer
├── package.json                  # postinstall: prisma generate
│
├── prisma/
│   ├── schema.prisma             # All DB models + enums (see §5)
│   ├── seed.ts
│   └── migrations/               # Historical migrations
│
├── scripts/
│   ├── backup.ts                 # DB backup utility
│   ├── import-assets.ts          # Bulk-import assets from spreadsheet/CSV
│   ├── migrate-uploads-to-db.ts  # One-off: move disk-stored uploads into UploadedFile table
│   ├── fix-leave-buddhist-years.ts     # Data-repair: normalize Buddhist-year leave dates
│   └── fix-html-entity-escaped-text.ts # Data-repair: un-escape HTML entities in stored text
│
├── public/
│   └── uploads/                  # Legacy/local upload dirs (superseded by DB-backed UploadedFile + /api/files/[id])
│
└── src/
    ├── proxy.ts                  # HTTPS redirect, CORS helper
    ├── types/
    │   └── index.ts              # All TypeScript interfaces and types (see §6)
    │
    ├── lib/
    │   ├── prisma.ts             # Prisma client singleton
    │   ├── auth.ts               # requireAuth, checkRole, isAdmin, isManagerOrAbove, createSession, getClientIp
    │   ├── security.ts           # hashPassword, Zod schemas, sanitizeInput, generateSecureToken
    │   ├── crypto.ts             # AES-256-GCM encrypt/decrypt (TOTP secret at rest) — needs TWO_FACTOR_ENC_KEY
    │   ├── twofactor.ts          # TOTP (otplib), backup codes, 2fa_pending challenge helpers
    │   ├── webauthn.ts           # Passkey RP config, base64url helpers, WebAuthn challenge store
    │   ├── rate-limit-db.ts      # DB-backed rate limiter (DatabaseRateLimiter)
    │   ├── line.ts                # LINE Messaging API — sendLineGroupMessage, replyLineMessage
    │   ├── logger.ts             # Structured logger (dev: pretty, prod: JSON; serializes Error message/stack)
    │   └── utils.ts              # cn(), formatDate, toBuddhistYear, etc.
    │
    ├── components/
    │   ├── dashboard/
    │   │   ├── types.ts                  # LeaveRecord, UserSummary, LeaveStatsData (dashboard-local types)
    │   │   ├── leaveTypeConfig.ts        # Colors/labels per LeaveType for charts & tables
    │   │   ├── StatCard.tsx              # Generic stat tile
    │   │   ├── LeaveFilterPanel.tsx      # Month/fiscal-year/type/date-range filters
    │   │   ├── LeaveChart.tsx            # Recharts leave breakdown
    │   │   ├── LeavePersonTable.tsx      # Per-user leave summary table
    │   │   ├── PendingApprovalsList.tsx  # Recent pending leave requests widget
    │   │   ├── RecentTasksList.tsx       # Recent kanban tasks widget
    │   │   ├── LowStockSuppliesWidget.tsx # Supplies at/under minimum quantity
    │   │   └── AssetStatusWidget.tsx     # In-use/in-repair counts + overdue checkouts
    │   └── leaves/
    │       ├── LeaveForm.tsx             # Sick/maternity/personal/etc. leave form + print
    │       ├── LeaveFormPDF.tsx
    │       ├── LateArrivalForm.tsx       # Dedicated form for LATE_ARRIVAL (มาสาย) type
    │       ├── LateArrivalFormPDF.tsx    # @react-pdf/renderer doc for late-arrival form
    │       └── pdf-fonts.ts
    │
    └── app/
        ├── globals.css
        ├── layout.tsx
        ├── page.tsx              # Login page (/)
        │
        ├── dashboard/
        │   ├── layout.tsx        # Sidebar + Header shell (nav includes เอกสาร, ตั้งค่า)
        │   ├── page.tsx          # Dashboard — composes widgets from components/dashboard/
        │   ├── employees/page.tsx
        │   ├── leaves/page.tsx
        │   ├── tasks/page.tsx    # Kanban board
        │   ├── supplies/page.tsx # พัสดุ — inventory, transactions, export
        │   ├── assets/page.tsx   # ครุภัณฑ์ — registry, checkout, inspection, export
        │   ├── documents/page.tsx # ทะเบียนรับ-ส่งหนังสือ — document register CRUD + export
        │   └── settings/page.tsx # ตั้งค่า — manage passkeys + 2FA status/backup codes
        │
        └── api/
            ├── auth/
            │   ├── login/route.ts                # password verify → requires2FA (VERIFY|ENROLL)
            │   ├── logout/route.ts
            │   ├── session/route.ts
            │   ├── 2fa/
            │   │   ├── route.ts                  # GET status (enabled, backupCodesRemaining)
            │   │   ├── setup/route.ts            # POST — generate secret + QR (enroll)
            │   │   ├── enable/route.ts           # POST — confirm code, enable, issue backup codes + session
            │   │   ├── verify/route.ts           # POST — TOTP or backup code → session
            │   │   ├── backup-codes/regenerate/route.ts  # POST — regen (needs current code)
            │   │   └── [userId]/route.ts         # DELETE — admin reset a user's 2FA
            │   └── passkey/
            │       ├── route.ts                  # GET list / (DELETE in [id])
            │       ├── [id]/route.ts             # DELETE a passkey
            │       ├── register/options/route.ts # POST (auth) — registration options
            │       ├── register/verify/route.ts  # POST (auth) — store authenticator
            │       ├── login/options/route.ts    # POST — auth options by username
            │       └── login/verify/route.ts     # POST — verify assertion → session
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
            │   ├── route.ts               # Aggregate stats + widget payloads (leaves, tasks, supplies, assets)
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
            ├── documents/
            │   ├── route.ts           # GET list / POST create (admin only)
            │   ├── [id]/route.ts      # GET / PATCH / DELETE (admin only)
            │   └── export/route.ts    # GET — Excel export of document register
            ├── uploads/
            │   └── document/route.ts  # POST — file upload (magic-byte MIME check) → stored in UploadedFile
            ├── files/
            │   └── [id]/route.ts      # GET — serve UploadedFile bytes (requires auth)
            ├── line/
            │   └── webhook/route.ts   # POST — LINE webhook (signature-verified); used to discover Group ID
            ├── cron/
            │   └── reminders/route.ts # GET — external cron hits this to push due task reminders to LINE (x-cron-secret)
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
│      ├── dashboard/page.tsx  ──► components/dashboard/*  │
│      ├── employees/page.tsx                              │
│      ├── leaves/page.tsx ──► LeaveForm.tsx /              │
│      │                       LateArrivalForm.tsx          │
│      ├── tasks/page.tsx                                  │
│      ├── supplies/page.tsx   (inventory + transactions)  │
│      ├── assets/page.tsx     (registry + checkout)       │
│      └── documents/page.tsx  (document register)         │
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
│  /api/asset-checkouts/*  /api/uploads/document            │
│  /api/documents/*  /api/files/[id]                        │
│  /api/line/webhook  /api/cron/reminders                  │
│  /api/departments  /api/positions  /api/holidays         │
│  /api/leave-rules  /api/health                           │
│                                                          │
│  All routes use:                                         │
│    lib/auth.ts ───────────────────────────────────┐      │
│    lib/security.ts (Zod schemas, sanitize) ───────┤      │
│    lib/rate-limit-db.ts (login + 2fa verify) ─────┤      │
│    lib/line.ts (task/cron reminders only) ────────┤      │
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
│            authenticators, webauthn_challenges,           │
│            two_factor_backup_codes, two_factor_challenges, │
│            tasks, kanban_columns,                          │
│            leaves, leave_rules,                            │
│            departments, positions, position_seconds,       │
│            holidays,                                       │
│            supply_categories, supplies,                    │
│            supply_transactions,                            │
│            asset_categories, assets, asset_checkouts,      │
│            uploaded_files, document_registers              │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Database Models & Enums

### Enums

| Enum | Values |
|---|---|
| **Role** | SUPER_ADMIN, ADMIN, MANAGER, HR, EMPLOYEE |
| **Priority** | LOW, MEDIUM, HIGH, URGENT |
| **LeaveType** | SICK, PERSONAL, MATERNITY, ORDINATION, EARLY_LEAVE, LATE_ARRIVAL, RUN_AN_ERRAND, OTHER |
| **LeaveStatus** | PENDING, APPROVED, REJECTED |
| **LeaveFormCategory** | KBK (แบบส่ง กบก.), STATS (แบบเก็บสถิติ) — mutually exclusive form-routing tag on a `Leave` |
| **SupplyType** | STOCK, NON_STOCK |
| **TransactionType** | RECEIVE, ISSUE, RETURN, ADJUST |
| **AssetStatus** | AVAILABLE, IN_USE, IN_REPAIR, RETURNED, DISPOSED |
| **AssetCondition** | EXCELLENT, GOOD, FAIR, POOR, DAMAGED |
| **DocumentDirection** | RECEIVE (หนังสือเข้า), SEND (หนังสือออก) |
| **DocumentCategory** | MEMO, EXTERNAL_LETTER, PW_NEWS, VEHICLE_SUPPORT_REQUEST, REFRESHMENT_SUPPORT_REQUEST |

> Note: `VACATION` was removed from `LeaveType`; `LATE_ARRIVAL` and `RUN_AN_ERRAND` were added, with dedicated `outTime`/`backTime` fields on `Leave` and a separate `LateArrivalForm` UI/PDF.

### Models

| Model | Key Fields | Relations |
|---|---|---|
| **User** | id, email (optional, unique), username, password, prefix, name, role, department, division, position, positionSecond, positionLevel, phone, birthday, address, avatar, profileImage, isActive, **twoFactorEnabled**, **twoFactorSecret** (encrypted) | → tasks, leaves, sessions, loginAttempts, **authenticators**, **backupCodes**, supplyTransactions, checkoutsHeld, checkoutsIssued, assetsHeld, **documentsRecorded** |
| **Session** | id, userId, token (unique), expiresAt, ipAddress, userAgent, isValid | → User |
| **LoginAttempt** | id, userId?, username, ipAddress, success, reason | → User? |
| **Authenticator** *(passkey)* | id, credentialId (unique), publicKey (base64url), counter, transports, deviceType, backedUp, name, userId, lastUsedAt | → User |
| **WebAuthnChallenge** | id (cuid), challenge, userId?, expiresAt | — (temp, cookie-referenced) |
| **TwoFactorBackupCode** | id, userId, codeHash (bcrypt), usedAt? | → User |
| **TwoFactorChallenge** | id (cuid), userId, pendingSecret? (encrypted), attempts, expiresAt | — (temp, `2fa_pending` cookie) |
| **KanbanColumn** | id, name, color, order, isDefault | → tasks |
| **Task** | id, title, description, columnId, priority, assigneeId, reminderAt, **reminderSentAt**, archivedAt | → KanbanColumn, User? |
| **Leave** | id, userId, type, startDate, endDate, reason, status, approvedBy, approvedAt, isHalfDay, hours, **outTime**, **backTime**, **formCategory**, totalDays, contactAddress | → User |
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
| **UploadedFile** *(added 2026-07)* | id (cuid), data (Bytes/LONGBLOB), mimeType, fileName, size, uploadedById?, createdAt | — (served via `/api/files/[id]`) |
| **DocumentRegister** *(added 2026-07)* | id, date, subject, direction, category?, documentNumber?, recipientName?, senderName?, remarks?, isActive, recordedById | → recordedBy (User) |

---

## 6. TypeScript Types (`src/types/index.ts`)

### User & Auth
`UserRole`, `User`, `Department`, `Position`, `PositionSecond`, `SessionUser`, `CreateUserInput`, `UpdateUserInput`, `LoginInput`, `LoginResponse`, `ChangePasswordInput`

### Tasks
`TaskPriority`, `KanbanColumn`, `Task`, `CreateTaskInput`, `UpdateTaskInput`

### Leaves
`LeaveType`, `LeaveStatus`, `LeaveFormCategory`, `Leave`, `CreateLeaveInput`, `UpdateLeaveInput`

### Supplies *(added 2026-06)*
`SupplyType`, `TransactionType`, `SupplyCategory`, `Supply`, `SupplyTransaction`, `CreateSupplyInput`, `CreateTransactionInput`

### Assets *(added 2026-06)*
`AssetStatus`, `AssetCondition`, `AssetCategory`, `Asset`, `AssetCheckout`, `CreateAssetInput`, `CreateCheckoutInput`

### Documents *(added 2026-07)*
`DocumentDirection`, `DocumentCategory`, `DocumentRegister`, `CreateDocumentRegisterInput`

### Dashboard widgets *(added 2026-07)*
`LowStockSupplySummary`, `OverdueCheckoutSummary`, `RecentPendingLeaveSummary`, `RecentTaskSummary` — trimmed shapes returned by `/api/dashboard` for the widget components in `src/components/dashboard/`

### API & UI Utilities
`ApiResponse<T>`, `ApiError`, `DashboardStats` (now also carries `lowStockCount`, `assetsInUse`, `assetsInRepair`, `overdueCheckoutsCount`), `RecentActivity`, `ChildrenProps`, `ModalProps`, `FormStatus`, `FormErrors`, `FormState<T>`

---

## 7. Zod Schemas (`src/lib/security.ts`)

| Schema | Validates |
|---|---|
| `loginSchema` | username (alphanum+_, 3-100), password (8-128) |
| `passkeyLoginSchema` | username only (start passkey login) |
| `createUserSchema` | email (optional), username, password (upper+lower+digit), prefix, name, role, department |
| `createTaskSchema` | title (1-255), description (max 1000), priority enum, columnId, assigneeId |
| `createLeaveSchema` | type enum, startDate/endDate (YYYY-MM-DD), reason (1-500), isHalfDay, hours, contactAddress; endDate ≥ startDate |
| `createSupplyCategorySchema` | name (1-100), description (max 255), order int |
| `createSupplySchema` | name, type enum, categoryId, supplyCode, unit, quantities, thresholds (1-99%), supplier, dates, unitPrice, documentNumber, imageUrl, notes |
| `createTransactionSchema` | supplyId, type enum, quantity (positive int), documentNumber, recipientName, returnerName, returnReceiverName, adjusterName, notes |
| `createAssetCategorySchema` | name (1-100), description, order |
| `createAssetSchema` | name, assetTag, serialNumber, model, brand, categoryId, status/condition enums, acquisitionDate (YYYY-MM-DD), documentNumber, location, department, imageUrl, notes, receiverName, lastInspectionDate, lastInspectionCondition, lastInspectedBy |
| `createCheckoutSchema` | assetId, holderId, issuedById (optional override), expectedReturnAt, notes |
| `createDocumentRegisterSchema` | date (YYYY-MM-DD), subject (1-500), direction enum, category enum (optional), documentNumber, recipientName, senderName, remarks |

**Security utilities:** `hashPassword`, `verifyPassword`, `sanitizeInput`, `generateSecureToken` (uses `crypto.randomBytes`), `generateAvatarInitials`

**2FA helpers (`src/lib/twofactor.ts`):** `generateTotpSecret`, `buildOtpAuthUri`, `verifyTotp` (otplib), `generateBackupCodes`/`findMatchingBackupCode`/`normalizeBackupCode`, `createPendingChallenge`/`getPendingChallenge`/`bumpChallengeAttempts`/`finishChallenge` (uses `2fa_pending` cookie)
**Crypto (`src/lib/crypto.ts`):** `encrypt`/`decrypt` — AES-256-GCM, key from `TWO_FACTOR_ENC_KEY` (base64 32 bytes)
**Passkey helpers (`src/lib/webauthn.ts`):** `getRpConfig`, `toBase64url`/`fromBase64url`, `parseTransports`/`serializeTransports`, `storeChallenge`/`consumeChallenge`
**LINE helpers (`src/lib/line.ts`):** `sendLineGroupMessage(text)` — group push for task reminders; `replyLineMessage` — used by the webhook to echo the Group ID during setup
**Session (`src/lib/auth.ts`):** `createSession(userId, request)` — shared by password/2FA/passkey login

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
  – bytes persisted to `uploaded_files` table (not disk) — served back via
    GET /api/files/[id] (requires auth); keeps files visible across all
    NAS-connected instances instead of being pinned to one machine's disk

XSS: sanitizeInput() — HTML entity encoding
SQL injection: parameterized queries via Prisma — no raw SQL

Role field protection: non-admin users cannot update position, department,
  division, positionLevel via PATCH /api/users/[id]

Two-factor (2FA / TOTP) — MANDATORY on password login:
  – /api/auth/login verifies password then returns requires2FA (no session yet)
  – mode VERIFY (enrolled) or ENROLL (forced first-time setup) via 2fa_pending cookie
  – session is issued only after /api/auth/2fa/verify or /enable succeeds
  – TOTP secret encrypted at rest (AES-256-GCM, crypto.ts); backup codes bcrypt-hashed, one-time
  – per-challenge attempt cap (5) + IP rate-limit on verify; admin can reset a user's 2FA
  – re-enroll guard: setup/enable refuse if user already has 2FA enabled

Passkey (WebAuthn) — alternative login, EXEMPT from 2FA (already strong MFA):
  – register while authenticated (settings); login by username → assertion → session
  – Authenticator stores credentialId + publicKey + counter; counter checked to prevent replay
  – RP config from env (RP_ID/RP_NAME/WEBAUTHN_ORIGIN); RP_ID must be a domain, not a bare IP

LINE webhook (/api/line/webhook): HMAC-SHA256 signature check against
  LINE_CHANNEL_SECRET using crypto.timingSafeEqual — rejects unsigned/forged events

Cron endpoint (/api/cron/reminders): shared-secret check (x-cron-secret header
  vs CRON_SECRET) using crypto.timingSafeEqual — not session-authenticated,
  intended to be called by Synology Task Scheduler / host cron
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
| Manage document register | ✗ | ✗ | ✗ | ✓ | ✓ |
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

### Document Register Flow
```
[Documents Page]
  │ POST /api/documents {date, subject, direction, category?, ...}
  ▼
[API] requireAuth → isAdmin → createDocumentRegisterSchema.safeParse
  │ documentRegister.create({recordedById: authUser.id})
  ▼
[DB] document_registers row created
  │
  │ GET /api/documents/export?direction=&category=&period=
  ▼
[API] ExcelJS workbook of the filtered register (หนังสือเข้า/ออก)
```

### Task Reminder Flow (LINE)
```
[Task created/edited with reminderAt]
  ▼
[External scheduler] GET /api/cron/reminders  (x-cron-secret header, ~every 1 min)
  ▼
[API] isAuthorized (timing-safe secret compare)
  │ task.findMany({reminderAt: {lte: now}, reminderSentAt: null, archivedAt: null})
  │ for each: sendLineGroupMessage(buildReminderMessage(task))
  │           → task.update({reminderSentAt: now})   (prevents duplicate sends)
  ▼
[LINE group] receives push notification
```
Setup helper: `/api/line/webhook` — invite the bot to the target LINE group, send
any message, the bot replies with that group's ID to paste into `LINE_GROUP_ID`.

### Authentication Flow (password + mandatory 2FA)
```
[Login Page]
  │ POST /api/auth/login {username, password}
  ▼
[API] Zod validate → dbRateLimit.isRateLimited(ip)
  │ user.findUnique({username}) → bcrypt.compare(password, hash)
  │ createPendingChallenge(userId) → set 2fa_pending cookie  (NO session yet)
  │ return { requires2FA, mode: twoFactorEnabled ? 'VERIFY' : 'ENROLL' }
  ▼
[Client] if ENROLL: POST /api/auth/2fa/setup → show QR → POST /api/auth/2fa/enable {code}
  │        if VERIFY: POST /api/auth/2fa/verify {code|backupCode}
  ▼
[API] verify TOTP (or backup code) → createSession() → Set HttpOnly cookie: session_token
  │ enable also: twoFactorEnabled=true, store encrypted secret, issue 10 backup codes
  ▼
[Client] router.push('/dashboard') — all later calls send cookie automatically
  ▼
[API] requireAuth(request) → session.findUnique({token})
  │ checks: session.isValid, expiresAt, user.isActive
  ▼
returns SessionUser { id, email, username, name, role, avatar }
```

### Passkey (WebAuthn) Login Flow — skips 2FA
```
[Login Page] "เข้าสู่ระบบด้วย passkey", username entered
  │ POST /api/auth/passkey/login/options {username}
  ▼
[API] generateAuthenticationOptions(allowCredentials) → storeChallenge → return options
  │ [Client] startAuthentication() → POST /api/auth/passkey/login/verify {response}
  ▼
[API] verifyAuthenticationResponse → update counter → createSession() → session_token cookie
  ▼
[Client] router.push('/dashboard')
```

### Late-Arrival Leave Form
`LeaveType.LATE_ARRIVAL` (มาสาย) uses a form/PDF pair separate from the general
`LeaveForm`/`LeaveFormPDF` used for sick/personal/maternity/etc.:
- `src/app/dashboard/leaves/page.tsx` branches on `selectedLeave.type === 'LATE_ARRIVAL'`
  to render `LateArrivalForm` instead of `LeaveForm`.
- `LateArrivalForm.tsx` computes fiscal-year (Oct 1–Sep 30) late-arrival stats
  (`LateArrivalStats`: exempt/late counts, past vs. total) from `userLeaves` and
  passes them into `LateArrivalFormPDF.tsx` for the printed/downloaded form.
- Both components strip a system-generated `[...]` prefix (half-day/hours/out-back-time
  tags) from `reason` before display via a shared `REASON_PREFIX_RE` regex —
  currently duplicated in both files (see §13).

---

## 11. Config & Environment

### `.env` (required variables)
```
DATABASE_URL=mysql://user:pass@host:3306/ems_db
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development|production
COOKIE_SAMESITE=strict|lax|none   (optional)

# Passkey (WebAuthn) — RP_ID must be a registrable domain, NOT a bare IP
RP_ID=localhost                   # prod: real hostname over HTTPS
RP_NAME=EMS TRD DTC               # also used as 2FA TOTP issuer
WEBAUTHN_ORIGIN=http://localhost:3000

# 2FA — encrypts TOTP secret at rest; back it up (losing it forces re-enrollment)
TWO_FACTOR_ENC_KEY=<openssl rand -base64 32>

# LINE Messaging API — task reminders (Group push, not the deprecated LINE Notify)
LINE_CHANNEL_ACCESS_TOKEN=<from LINE Developers console>
LINE_CHANNEL_SECRET=<from LINE Developers console>          # verifies /api/line/webhook signatures
LINE_GROUP_ID=<discovered via /api/line/webhook, see §10>

# Cron — protects /api/cron/reminders from unauthenticated calls
CRON_SECRET=<random string, matched via x-cron-secret header>

# Optional: backups, logging shipping (see lib/logger.ts, scripts/backup.ts)
BACKUP_DIR=, BACKUP_RETENTION_DAYS=
LOG_LEVEL=, LOG_SERVICE=, LOG_SERVICE_URL=, LOG_SERVICE_KEY=
ALLOWED_ORIGINS=   # explicit CORS allowlist for prod (see proxy.ts)
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
| bcryptjs | ^2.4.3 | Password hashing + backup-code hashing |
| @simplewebauthn/server | ^13.3.2 | Passkey (WebAuthn) server verification |
| @simplewebauthn/browser | ^13.3.0 | Passkey client ceremony (startRegistration/Authentication) |
| otplib | ^13.4.1 | TOTP generate/verify (2FA) |
| qrcode | ^1.5.4 | 2FA enrollment QR (data URL) |
| exceljs | ^4.4.0 | Supplies/documents Excel export (styled) |
| xlsx | ^0.18.5 | Assets Excel export |
| file-type | ^22.0.1 | Server-side MIME detection for uploads |
| @react-pdf/renderer | ^4.3.2 | Leave / late-arrival PDF generation |
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
| @types/node, react, bcryptjs, qrcode | various |

---

## 13. Technical Debt & Known Issues

| Location | Issue | Severity |
|---|---|---|
| `next.config.js:44` | CSP includes `'unsafe-inline'` and `'unsafe-eval'` — weakens XSS protection. Requires nonce-based CSP or isolating the library that needs eval. | High |
| `src/lib/security.ts` | `containsSqlInjection()` function exists but is never called in any API route — dead code. Remove or wire up. | Low |
| `src/proxy.ts:27` | CORS allows wildcard in dev — should specify explicit domain for production. | Medium |
| All GET supply/asset routes | No `isManagerOrAbove` check — EMPLOYEE role can enumerate all supplies, transactions, and asset checkouts. | Medium |
| No test files | Zero unit/integration tests across the entire codebase. | High |
| Session cleanup | Expired sessions accumulate in DB — no cron job to prune `sessions` table. Same applies to `webauthn_challenges` and `two_factor_challenges` (only deleted on success/expiry-hit; abandoned login flows leave rows). | Medium |
| Hand-written migrations | Some early migration SQL (passkey/2FA) was authored by hand (NAS DB unreachable from dev). Verify with `prisma migrate status` after `migrate deploy`. | Medium |
| Mandatory 2FA rollout | All existing users are forced into 2FA enrollment at next login. Admin-reset endpoint (`DELETE /api/auth/2fa/[userId]`) covers lost devices; ensure ≥1 admin can enroll. | Low |
| `LeaveForm.tsx` / `LateArrivalForm.tsx` | Fiscal year calc (Oct 1–Sep 30) is duplicated across `leave-stats` API, `LeaveForm.tsx`, and `LateArrivalForm.tsx`. Should be a shared utility. | Low |
| `LateArrivalForm.tsx` / `LateArrivalFormPDF.tsx` | `REASON_PREFIX_RE` regex and `formatThaiDate`/`thaiMonths` are duplicated verbatim in both files instead of shared. | Low |
| `public/uploads/` | Legacy disk-based upload dir; uploads now persist to the `uploaded_files` DB table via `scripts/migrate-uploads-to-db.ts`. Confirm no code path still writes here before removing. | Low |
| `/api/cron/reminders` | Relies solely on a static shared secret (`CRON_SECRET`) with no rate limiting — acceptable for a NAS-internal scheduler but would need hardening if ever exposed publicly. | Low |
| `src/lib/logger.ts` | Production JSON logs have no rotation/shipping configured by default (optional `LOG_SERVICE*` env vars exist but are unset). | Low |

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

pnpm db:import-assets       # Bulk-import assets (scripts/import-assets.ts)
pnpm db:migrate-uploads     # One-off: move disk uploads into UploadedFile table
pnpm db:fix-leave-years     # Data repair: Buddhist-year leave dates
pnpm db:fix-html-entities   # Data repair: un-escape HTML entities in stored text
pnpm db:backup / db:backup:list / db:restore

npx prisma db push  # Sync schema to DB without migration (used for new fields)

docker-compose up -d              # Start MariaDB
docker-compose --profile admin up # + phpMyAdmin on :8080
```

---

## 15. Suggested Next Features

### Audit Log
- Add `AuditLog` model (entity, action, userId, changes JSON, createdAt)
- Wire into user/supply/asset/document mutations
- New admin page: `/dashboard/audit`

### Notifications / Reminders
- Task reminders now push to LINE (`/api/cron/reminders`) — extend the same pattern to
  leave approvals/rejections and asset overdue-return alerts
- In-app `Notification` model (userId, message, isRead, createdAt) as an alternative/complement to LINE

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
- Low-stock email/LINE alerts for STOCK supplies (dashboard widget already surfaces this; automate the push)

### Document Register Enhancements
- Attach scanned files (`UploadedFile`) directly to a `DocumentRegister` row
- Full-text search across `subject`/`remarks`
