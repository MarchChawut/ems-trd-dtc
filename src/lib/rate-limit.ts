/**
 * ============================================================
 * General Rate Limiter (in-memory, per-process)
 * ============================================================
 *
 * ใช้สำหรับ throttling endpoints ทั่วไป (สร้าง/นำเข้าข้อมูล)
 * แยกจาก `rate-limit-db.ts` ที่ใช้กับ login attempts โดยเฉพาะ
 *
 * Limitations:
 *   - in-memory: ไม่ทำงานข้าม process / instance — เหมาะกับ single-instance deploy (Synology)
 *   - ถ้าจะรองรับ multi-instance ในอนาคต ให้ย้ายไปใช้ Redis หรือ DB-backed
 *
 * Usage:
 *   const result = checkRateLimit(`import:user-${userId}`, 5, 15 * 60_000);
 *   if (!result.allowed) return 429;
 */

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();
const MAX_BUCKETS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;       // unix ms
  retryAfterSec: number; // 0 ถ้า allowed
}

/**
 * ตรวจสอบ + เพิ่ม counter ใน window ปัจจุบัน
 *
 * @param key       ตัวระบุ (เช่น `import:user-123` หรือ `create:ip-1.2.3.4`)
 * @param limit     จำนวน request สูงสุดต่อ window
 * @param windowMs  ระยะเวลา window (ms)
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);

  // เริ่ม bucket ใหม่ ถ้าไม่มีหรือหมดอายุ
  if (!bucket || now >= bucket.resetAt) {
    // ลบ bucket เก่าสุด ถ้าเต็ม cap
    if (buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) buckets.delete(oldestKey);
    }
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  const allowed = bucket.count <= limit;
  const remaining = Math.max(0, limit - bucket.count);
  const retryAfterSec = allowed ? 0 : Math.ceil((bucket.resetAt - now) / 1000);

  return {
    allowed,
    limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSec,
  };
}

/**
 * รีเซ็ต counter ของ key หนึ่ง (ใช้กรณี admin override)
 */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * ดึง IP address จาก request — รองรับ proxy header
 */
export function getClientIp(req: Request): string {
  // x-forwarded-for อาจมีหลาย IP ต่อด้วย comma — เอาตัวแรก
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || 'unknown';

  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}

/**
 * Helper: สร้าง JSON response สำหรับ 429 Too Many Requests พร้อม header มาตรฐาน
 */
export function rateLimitResponse(result: RateLimitResult, message?: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'RATE_LIMITED',
      message: message ?? `คำขอบ่อยเกินไป กรุณาลองใหม่อีก ${result.retryAfterSec} วินาที`,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfterSec),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}
