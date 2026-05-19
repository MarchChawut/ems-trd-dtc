# EMS V.2.0 — Migration Playbook

> **Audience:** SUPER_ADMIN (chawut.sa, spore)
> **System:** Production EMS — TRD/DTC
> **Pattern:** Strangler Fig (expand → migrate → contract)
> **Expected downtime:** <30 วินาที (Stage E เท่านั้น — scheduled maintenance)

---

## 🎭 Role Policy (V.2.0)

| Role | จำนวน | คน | สิทธิ์ |
|---|---|---|---|
| `SUPER_ADMIN` | 2 | chawut.sa, spore | login + reveal PII (ผ่าน step-up) |
| `ADMIN` | 2 | slyth, spad | login, จัดการ leaves/tasks, **ห้าม** reveal |
| `EMPLOYEE` | N | คนอื่นทั้งหมด | **ไม่มี login** — เป็น data record อย่างเดียว |

---

## ✈️ Pre-flight Checklist

ทำให้ครบทุกข้อ **ก่อนเริ่ม Stage A**

- [ ] **Full backup** Main DB → encrypted offline copy + ทดสอบ restore บน staging แล้ว
- [ ] **Staging environment** พร้อม — clone production data (PII masked สำหรับ compliance)
- [ ] **Master Key (KEK)** สร้างเสร็จ + เก็บ 3 copies ครบ:
  - Synology Encrypted Shared Folder (working copy)
  - USB encrypted ในตู้เซฟ chawut.sa
  - USB encrypted ในตู้เซฟ spore
- [ ] **Vault container** deployed บน NAS (network namespace แยก, port 3306 internal-only)
- [ ] **mTLS certs** generated (Main app ↔ Vault service)
- [ ] **Rollback scripts** เขียนเสร็จและทดสอบบน staging แล้ว
- [ ] **Feature flags** ใส่ใน Main app:
  - `VAULT_DUAL_WRITE` (default: false)
  - `VAULT_READ_PERCENT` (0-100, canary)
- [ ] **Monitoring** — alerts: vault error rate >1%, diff job ≠ 0
- [ ] **Stakeholder sign-off** — chawut.sa + spore เซ็นเอกสาร

---

## Stage A — Expand (สัปดาห์ 1-3)

> **Goal:** เพิ่ม schema ใหม่โดยไม่กระทบของเดิมเลย

### Actions
1. Apply migration บน Main DB:
   ```sql
   -- A1: สร้าง EmployeeGroup table
   CREATE TABLE employee_groups (
     id INT AUTO_INCREMENT PRIMARY KEY,
     code VARCHAR(10) NOT NULL UNIQUE,
     name VARCHAR(100) NOT NULL,
     description VARCHAR(255) NULL,
     is_active BOOLEAN NOT NULL DEFAULT TRUE,
     `order` INT NOT NULL DEFAULT 0,
     created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
     updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
     INDEX idx_active_order (is_active, `order`)
   );

   -- A2: เพิ่ม columns ใน users (ทั้งหมด nullable — ยังไม่เปลี่ยน behavior)
   ALTER TABLE users
     ADD COLUMN group_id INT NULL,
     ADD COLUMN running_number INT NULL,
     ADD COLUMN employee_code VARCHAR(20) NULL,
     ADD CONSTRAINT uk_users_employee_code UNIQUE (employee_code),
     ADD CONSTRAINT uk_users_group_running UNIQUE (group_id, running_number),
     ADD CONSTRAINT fk_users_group FOREIGN KEY (group_id) REFERENCES employee_groups(id);

   -- A3: ทำ username + password ให้ nullable (เพื่อ Stage D)
   ALTER TABLE users
     MODIFY COLUMN username VARCHAR(100) NULL,
     MODIFY COLUMN password VARCHAR(255) NULL;

   -- A4: Seed default groups
   INSERT INTO employee_groups (code, name) VALUES
     ('TRD1', 'ทีม TRD ชุดที่ 1'),
     ('TRD2', 'ทีม TRD ชุดที่ 2'),
     ('DEV',  'ทีมพัฒนา');
   ```

2. Deploy Vault container บน NAS (Docker Compose):
   - MariaDB ตัวที่ 2 (internal network only)
   - Vault service (Fastify + Prisma)
   - mTLS cert mounted read-only
3. Apply Vault DB schema (ดูไฟล์ `vault-schema.prisma`)
4. Vault container health check ผ่าน — แต่ **ยังไม่มี client เรียกใช้**

### Verification
- [ ] `SELECT COUNT(*) FROM employee_groups` = 3
- [ ] `SELECT COUNT(*) FROM users WHERE employee_code IS NULL` = current user count (ทั้งหมดยัง null)
- [ ] App version เดิมยังทำงาน 100% — ไม่มี regression
- [ ] Vault API `/health` → 200 OK
- [ ] mTLS handshake test สำเร็จ (จาก Main app container)

### Rollback
```sql
ALTER TABLE users
  DROP FOREIGN KEY fk_users_group,
  DROP INDEX uk_users_employee_code,
  DROP INDEX uk_users_group_running,
  DROP COLUMN group_id,
  DROP COLUMN running_number,
  DROP COLUMN employee_code;
-- (username, password ปล่อย nullable ไว้ก็ได้ — ไม่กระทบ)
DROP TABLE employee_groups;
```
+ Stop & remove Vault container

---

## Stage B — Backfill (สัปดาห์ 4)

> **Goal:** ใส่ `employee_code` ให้ทุก user + เข้ารหัส PII ทั้งหมดเข้า Vault
> **ไม่กระทบ runtime** — backfill ทำเป็น batch job

### Actions
1. **CSV mapping ที่ SUPER_ADMIN เตรียมล่วงหน้า:**
   ```csv
   user_id,group_code
   1,TRD1
   2,TRD1
   3,TRD2
   4,DEV
   ...
   ```
   Validation: ทุก user_id ต้องมี mapping (ไม่มีก็ default `EMPLOYEE` → กำหนด fallback group)

2. **Backfill script** (rate-limited, transactional ต่อ user):
   ```ts
   for batch of users WHERE employee_code IS NULL (LIMIT 100):
     BEGIN TRANSACTION:
       1. lookup group_code from CSV
       2. group_id = SELECT id FROM employee_groups WHERE code = group_code
       3. running_number = SELECT COALESCE(MAX(running_number), 0) + 1
                           FROM users WHERE group_id = ? FOR UPDATE
       4. employee_code = printf("%s-%06d", group_code, running_number)
       5. dek = generateKey()
       6. encrypted = { encName: AES-GCM(name, dek), ... }
       7. wrappedDek = AES-GCM(dek, KEK)
       8. POST /vault/identity { employeeCode, wrappedDek, encrypted, hashes }
       9. UPDATE users SET group_id=?, running_number=?, employee_code=?
     COMMIT
     sleep(100ms)  -- rate limit
   ```

3. รัน **reconciliation script**:
   - decrypt Vault.encName สำหรับ random 5% sample
   - เทียบกับ Main.name
   - report 0 diffs ก่อน proceed

### Verification
- [ ] `SELECT COUNT(*) FROM users WHERE employee_code IS NULL` = 0
- [ ] `Vault: COUNT(identities)` == `Main: COUNT(users)`
- [ ] Sample reconciliation 5% → 100% match
- [ ] ทุก employeeCode unique และ format ถูกต้อง

### Rollback
```sql
-- Main DB
UPDATE users SET employee_code = NULL, group_id = NULL, running_number = NULL;
-- Vault DB
TRUNCATE TABLE identities;
INSERT INTO vault_audit_log (...) VALUES (rollback_marker);
```

---

## Stage C — Dual-write (สัปดาห์ 5-6)

> **Goal:** ทุก write ลงทั้ง Main + Vault — Read ยังใช้ Main DB เพื่อปลอดภัย

### Actions
1. Deploy app version ใหม่:
   - `VAULT_DUAL_WRITE=true`
   - POST/PATCH `/api/users` → write Main + write Vault (transactional best-effort)
   - GET ยังอ่านจาก Main DB
2. รัน **nightly shadow comparison** (02:00 ทุกวัน):
   - decrypt ทุก Vault.encName/encPhone/... → เทียบกับ Main DB
   - alert ถ้า diff > 0
   - generate report ส่ง SUPER_ADMIN
3. Fix diff ทั้งหมดก่อน proceed (target: 7 วันติดต่อกัน 0 diff)

### Verification
- [ ] Nightly diff report = 0 ต่อเนื่อง **7 วัน**
- [ ] ไม่มี vault error ใน audit log
- [ ] Write latency เพิ่มไม่เกิน 100ms (p99)

### Rollback
- Set `VAULT_DUAL_WRITE=false` → กลับมาเขียน Main DB ที่เดียว
- Vault data ยังอยู่ — ใช้ใน Stage D ต่อได้

---

## Stage D — Cutover (สัปดาห์ 7) ⚠️ behavior change

> **Goal:** เปลี่ยน read path → Vault | ลบ login ของ EMPLOYEE | UI เปลี่ยนเป็น masked

### Actions

#### D1. Deploy UI ใหม่
- Default view: masked
- ปุ่ม **🔓 ดูข้อมูลจริง** (เห็นเฉพาะ SUPER_ADMIN)
- Reveal modal: ขอเหตุผล (≥ 10 ตัวอักษร) + ใส่ password อีกครั้ง
- หน้า **Audit Log** (SUPER_ADMIN เห็น)
- หน้า **จัดการกลุ่ม** (SUPER_ADMIN เห็น)

#### D2. Canary toggle
```
Day 1:  VAULT_READ_PERCENT = 10
Day 3:  VAULT_READ_PERCENT = 50
Day 5:  VAULT_READ_PERCENT = 100
```
Monitor: latency, error rate, vault audit log

#### D3. ลบ login ของ EMPLOYEE role
```sql
-- (1) Invalidate sessions ที่ active อยู่
UPDATE sessions SET is_valid = FALSE
  WHERE user_id IN (
    SELECT id FROM users WHERE role = 'EMPLOYEE'
  );

-- (2) ลบ credentials ของ EMPLOYEE
UPDATE users
  SET password = NULL,
      username = NULL
  WHERE role = 'EMPLOYEE';
```

#### D4. Simplify Role enum
```sql
-- Migrate รายเก่าที่อาจเป็น MANAGER/HR
UPDATE users SET role = 'ADMIN' WHERE role IN ('MANAGER', 'HR');
UPDATE users SET role = 'EMPLOYEE' WHERE role NOT IN ('SUPER_ADMIN', 'ADMIN');
-- Note: Prisma migration จะ drop enum values ตอน next schema apply
```

### Verification
- [ ] p99 latency ของ list users ไม่เพิ่มเกิน 10% เมื่อเทียบกับ V.1.0 baseline
- [ ] Vault error rate < 0.1%
- [ ] เฉพาะ SUPER_ADMIN + ADMIN login ได้
- [ ] EMPLOYEE login → "บัญชีถูกปิดใช้งาน" (401)
- [ ] SUPER_ADMIN กดปุ่ม reveal → ได้ PII + ปรากฏใน audit log
- [ ] ADMIN กดปุ่ม reveal → 403 + log failed attempt
- [ ] Active sessions ของ EMPLOYEE ทั้งหมด invalidated

### Rollback
1. `VAULT_READ_PERCENT = 0` → กลับมาอ่าน Main DB
2. ปลด session invalidation (ถ้าจำเป็นจริง ๆ — ปกติไม่ rollback ตรงนี้)
3. Re-enable employee logins (restore credentials จาก backup ถ้าผู้ใช้ร้อง)

---

## Stage E — Contract (สัปดาห์ 8-9) ⚠️ DESTRUCTIVE — POINT OF NO RETURN

> **Goal:** ลบ PII columns ออกจาก Main DB ถาวร

### Pre-conditions (ครบทุกข้อเท่านั้น)
- [ ] Stage D ทำงาน **14 วันติดต่อกัน** ไม่มี vault error
- [ ] Full encrypted backup ของ Main DB เก็บ offline (เก็บไว้ 90 วัน)
- [ ] Sign-off เป็นลายลักษณ์อักษรจาก chawut.sa **และ** spore
- [ ] Maintenance window แจ้ง ADMIN + ผู้บริหารล่วงหน้า ≥ 48 ชม.
- [ ] Smoke test plan พร้อม

### Actions
```sql
-- Maintenance window (~30 วินาที lock บน users table)
START TRANSACTION;

ALTER TABLE users
  DROP COLUMN name,
  DROP COLUMN prefix,
  DROP COLUMN phone,
  DROP COLUMN birthday,
  DROP COLUMN address,
  DROP COLUMN email,
  DROP COLUMN profile_image;

-- Make employee_code NOT NULL ตอนนี้
ALTER TABLE users
  MODIFY COLUMN employee_code VARCHAR(20) NOT NULL,
  MODIFY COLUMN group_id INT NOT NULL,
  MODIFY COLUMN running_number INT NOT NULL;

COMMIT;
```

### Verification
- [ ] `mysqldump users > dump.sql && grep '08' dump.sql | grep -E '[0-9]{3}-[0-9]{4}'` → **ไม่เจอเบอร์โทร**
- [ ] App smoke test ผ่าน 100%:
  - [ ] Login (SUPER_ADMIN + ADMIN)
  - [ ] List users (masked)
  - [ ] Reveal flow
  - [ ] Create/edit leave
  - [ ] Export PDF
- [ ] Vault service ทำงานปกติ

### Rollback
**⚠️ ไม่มี rollback อัตโนมัติ** — point of no return

หากเกิดเหตุการณ์ disaster:
1. หยุดรับ traffic
2. Restore Main DB จาก backup ของ pre-Stage-E (downtime ~1 ชม.)
3. กลับไปอยู่ Stage D state
4. Post-mortem + แก้ root cause ก่อน try again

---

## 📝 Sign-off Template

```
====================================================
Stage: ____  (A / B / C / D / E)
Date: ________________________
====================================================

Verification checklist completed: [ ] YES  [ ] NO
Rollback procedure tested:        [ ] YES  [ ] NO
Monitoring alerts active:         [ ] YES  [ ] NO

Approved by:
  ┌─────────────────────────────┐
  │ chawut.sa (SUPER_ADMIN #1)  │  signature: ______________
  │                              │  date:      ______________
  └─────────────────────────────┘

  ┌─────────────────────────────┐
  │ spore     (SUPER_ADMIN #2)  │  signature: ______________
  │                              │  date:      ______________
  └─────────────────────────────┘

Decision: [ ] Proceed to next stage  [ ] Hold  [ ] Rollback

Notes:
__________________________________________________________
__________________________________________________________
```

---

## 🚨 Emergency Procedures

### Vault service ล่ม
1. App degrade gracefully → แสดง masked เท่านั้น (Main DB ยังมีข้อมูลพอ)
2. Reveal button → disabled + banner "Vault unavailable"
3. แจ้ง SUPER_ADMIN ทันทีผ่าน LINE/Telegram alert
4. Check container logs → restart
5. หากต้อง failover: deploy backup container + restore Vault DB จาก backup ล่าสุด

### Master Key หาย
1. ใช้ backup copy จาก spore **หรือ** chawut.sa (1-of-2 quorum)
2. Re-upload เข้า Synology Encrypted Folder
3. Restart Vault container — ตรวจ decrypt test record สำเร็จ
4. **Post-mortem:** หา root cause + พิจารณาเพิ่ม backup ที่ 3 (เช่น offsite safe deposit box)

### Audit Log แสดง reveal ที่น่าสงสัย
1. Block actor account ทันที (`UPDATE users SET is_active=FALSE`)
2. Export audit log ของ actor → forensic review
3. แจ้ง SUPER_ADMIN ทั้ง 2 คน
4. หากกระทบพนักงาน → ออก transparency report ตาม PDPA (ภายใน 72 ชม.)

### Diff ใน Stage C ไม่ลดลง
1. หยุด proceed ไป Stage D
2. ตรวจสาเหตุ: race condition? Vault timeout? mTLS issue?
3. Fix root cause ก่อน restart Stage C countdown

---

## 📊 Effort Estimate

| Stage | Duration | Risk | Reversible? |
|---|---|---|---|
| A. Expand | 2-3 สัปดาห์ | Low | ✅ |
| B. Backfill | 1 สัปดาห์ | **High** | ✅ (มี truncate script) |
| C. Dual-write | 2 สัปดาห์ | Medium | ✅ (toggle flag) |
| D. Cutover | 1 สัปดาห์ | Medium | ✅ (canary + restore) |
| E. Contract | 1-2 สัปดาห์ | **Critical** | ❌ (ต้อง restore backup) |
| **Total** | **7-9 สัปดาห์** | | |
