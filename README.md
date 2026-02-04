# EMS Admin - Employee Management System

ระบบบันทึกและจัดการพนักงานครบวงจร พัฒนาด้วย Next.js + TypeScript + MariaDB

## คุณสมบัติหลัก

- **ระบบจัดการพนักงาน** - เพิ่ม ลบ แก้ไขข้อมูลพนักงาน
- **ระบบจัดการงาน (Kanban)** - ติดตามสถานะงานแบบ Drag & Drop
- **ระบบบันทึกการลา** - ยื่นคำขอลาและอนุมัติผ่านระบบ
- **แดชบอร์ดสถิติ** - ภาพรวมของระบบทั้งหมด
- **ระบบความปลอดภัย** - Authentication แบบเข้มข้น พร้อมการป้องกัน Brute Force, XSS, SQL Injection

## สถาปัตยกรรมระบบ

```
┌─────────────────────────────────────────────────────────────┐
│                    Synology NAS                              │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  Container      │    │         Web Station              │ │
│  │  Manager        │    │                                  │ │
│  │                 │    │  ┌──────────────────────────┐   │ │
│  │  ┌───────────┐  │    │  │   Next.js Frontend       │   │ │
│  │  │ MariaDB 10│  │    │  │   (Port 3000)            │   │ │
│  │  │ (Port     │◄─┼────┼──┤                          │   │ │
│  │  │  3306)    │  │    │  │  - React Components      │   │ │
│  │  └───────────┘  │    │  │  - API Routes            │   │ │
│  │                 │    │  │  - Server-side Rendering │   │ │
│  └─────────────────┘    │  └──────────────────────────┘   │ │
│                         └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## ความต้องการของระบบ

- **Node.js** 18.x หรือสูงกว่า
- **MariaDB** 10.x
- **npm** หรือ **yarn**

## การติดตั้ง

### 1. ติดตั้ง MariaDB บน Synology NAS

#### วิธีที่ 1: ใช้ Container Manager

1. เปิด **Container Manager** บน Synology NAS
2. สร้างโปรเจกต์ใหม่และใช้ไฟล์ `docker-compose.yml` นี้
3. รันคำสั่ง:

```bash
# รัน MariaDB อย่างเดียว
docker-compose up -d

# รัน MariaDB + phpMyAdmin (สำหรับจัดการฐานข้อมูล)
docker-compose --profile admin up -d
```

4. phpMyAdmin จะอยู่ที่ `http://your-synology-ip:8080`

#### วิธีที่ 2: ใช้ Package Center

1. ติดตั้ง **MariaDB 10** จาก Package Center
2. ติดตั้ง **phpMyAdmin** จาก Package Center (optional)
3. สร้าง database และ user ผ่าน phpMyAdmin:

```sql
CREATE DATABASE ems_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ems_user'@'%' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON ems_db.* TO 'ems_user'@'%';
FLUSH PRIVILEGES;
```

### 2. ตั้งค่าโปรเจกต์

1. คัดลอกไฟล์ `.env.example` เป็น `.env`:

```bash
cp .env.example .env
```

2. แก้ไขค่าใน `.env`:

```env
# การเชื่อมต่อ MariaDB
DATABASE_URL="mysql://ems_user:your_password@your-synology-ip:3306/ems_db"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-min-32-characters-long"
NEXTAUTH_URL="http://localhost:3000"

# ความปลอดภัย
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=30
SESSION_EXPIRY_HOURS=24
```

### 3. ติดตั้ง Dependencies

```bash
npm install
```

### 4. สร้างตารางฐานข้อมูล

```bash
# สร้าง migration
npx prisma migrate dev --name init

# หรือใช้ db push (สำหรับ development)
npx prisma db push
```

### 5. Seed ข้อมูลเริ่มต้น

```bash
npm run db:seed
```

ข้อมูลเริ่มต้น:
- **Admin**: username: `admin`, password: `admin123`
- **Users**: 4 คน (พร้อมข้อมูลตัวอย่าง)

### 6. รันแอปพลิเคชัน

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

เข้าใช้งานที่ `http://localhost:3000`

## การ Deploy บน Synology Web Station

### 1. Build โปรเจกต์

```bash
npm run build
```

### 2. คัดลอกไฟล์ไปยัง Web Station

```bash
# คัดลอกไฟล์ทั้งหมดไปยังโฟลเดอร์ของ Web Station
rsync -avz --exclude=node_modules --exclude=.git ./ admin@your-synology-ip:/volume1/web/ems-admin/
```

### 3. ตั้งค่า Web Station

1. เปิด **Web Station** บน DSM
2. สร้าง Virtual Host ใหม่:
   - **Hostname**: ems.your-domain.com (หรือ IP)
   - **Document Root**: `/web/ems-admin`
   - **Port**: 3000 (หรือพอร์ตที่ต้องการ)
   - **HTTPS**: แนะนำให้เปิดใช้งาน

### 4. ตั้งค่า Reverse Proxy (แนะนำ)

1. ไปที่ **Control Panel** > **Application Portal** > **Reverse Proxy**
2. สร้าง rule ใหม่:
   - **Source**: `https://ems.your-domain.com`
   - **Destination**: `http://localhost:3000`

## โครงสร้างโปรเจกต์

```
ems-admin/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Seed data
├── src/
│   ├── app/
│   │   ├── api/           # API Routes
│   │   │   ├── auth/      # Authentication APIs
│   │   │   ├── users/     # User APIs
│   │   │   ├── tasks/     # Task APIs
│   │   │   ├── leaves/    # Leave APIs
│   │   │   └── dashboard/ # Dashboard APIs
│   │   ├── dashboard/     # Dashboard pages
│   │   │   ├── page.tsx   # Dashboard home
│   │   │   ├── tasks/     # Tasks page
│   │   │   ├── leaves/    # Leaves page
│   │   │   └── employees/ # Employees page
│   │   ├── page.tsx       # Login page
│   │   └── layout.tsx     # Root layout
│   ├── components/        # React components
│   ├── lib/
│   │   ├── prisma.ts      # Prisma client
│   │   ├── auth.ts        # Auth utilities
│   │   ├── security.ts    # Security functions
│   │   └── utils.ts       # Utility functions
│   └── types/
│       └── index.ts       # TypeScript types
├── docker-compose.yml     # Docker Compose config
├── next.config.js         # Next.js config
├── tailwind.config.ts     # Tailwind CSS config
├── tsconfig.json          # TypeScript config
└── package.json           # Dependencies
```

## ระบบความปลอดภัย

### Authentication
- Session-based authentication ด้วย secure cookies
- รหัสผ่านเข้ารหัสด้วย bcrypt (12 rounds)
- Session หมดอายุอัตโนมัติหลัง 24 ชั่วโมง

### การป้องกัน Brute Force
- จำกัดจำนวนครั้งการเข้าสู่ระบบผิดพลาด (5 ครั้ง)
- บล็อก IP เป็นเวลา 30 นาทีหากเกินกำหนด
- บันทึกประวัติการพยายามเข้าสู่ระบบทั้งหมด

### การป้องกัน XSS
- Sanitize ข้อมูล input ทั้งหมด
- Content Security Policy (CSP) headers
- Escape HTML entities

### การป้องกัน SQL Injection
- ใช้ Prisma ORM (Parameterized queries)
- ตรวจสอบ patterns ที่น่าสงสัย
- Input validation ด้วย Zod schema

### Security Headers
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security`
- `Content-Security-Policy`

## API Documentation

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | เข้าสู่ระบบ |
| POST | `/api/auth/logout` | ออกจากระบบ |
| GET | `/api/auth/session` | ตรวจสอบ session |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | ดึงรายชื่อผู้ใช้ทั้งหมด |
| POST | `/api/users` | สร้างผู้ใช้ใหม่ |
| GET | `/api/users/[id]` | ดึงข้อมูลผู้ใช้ |
| PATCH | `/api/users/[id]` | อัปเดตข้อมูลผู้ใช้ |
| DELETE | `/api/users/[id]` | ลบผู้ใช้ |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | ดึงรายการงานทั้งหมด |
| POST | `/api/tasks` | สร้างงานใหม่ |
| PATCH | `/api/tasks/[id]` | อัปเดตงาน |
| DELETE | `/api/tasks/[id]` | ลบงาน |

### Leaves

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leaves` | ดึงรายการลาทั้งหมด |
| POST | `/api/leaves` | สร้างรายการลา |
| PATCH | `/api/leaves/[id]` | อนุมัติ/ไม่อนุมัติการลา |
| DELETE | `/api/leaves/[id]` | ลบรายการลา |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | ดึงข้อมูลสถิติแดชบอร์ด |

## คำสั่งที่ใช้บ่อย

```bash
# Development
npm run dev              # รัน development server
npm run build            # Build สำหรับ production
npm start                # รัน production server

# Database
npm run db:generate      # สร้าง Prisma client
npm run db:migrate       # รัน migration
npm run db:studio        # เปิด Prisma Studio
npm run db:seed          # Seed ข้อมูลเริ่มต้น

# Lint
npm run lint             # ตรวจสอบโค้ด
```

## การแก้ไขปัญหา

### ปัญหาการเชื่อมต่อ MariaDB

```bash
# ตรวจสอบว่า MariaDB รันอยู่หรือไม่
docker ps | grep mariadb

# ดู logs
docker logs ems-mariadb

# ทดสอบการเชื่อมต่อ
mysql -h your-synology-ip -P 3306 -u ems_user -p
```

### ปัญหา Prisma

```bash
# รีเซ็ต Prisma
npx prisma generate
npx prisma db push

# ดู query logs
DEBUG="prisma:*" npm run dev
```

## License

MIT License

## ผู้พัฒนา

EMS Development Team

## การสนับสนุน

หากมีปัญหาหรือคำถาม กรุณาติดต่อผู้ดูแลระบบ
