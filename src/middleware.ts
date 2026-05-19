/**
 * ============================================================
 * Next.js Middleware — CSRF Protection (Origin/Referer check)
 * ============================================================
 *
 * Defense-in-depth strategy:
 *   1. Session cookies already use SameSite=Strict (login route)
 *   2. This middleware adds Origin/Referer validation as a second line
 *      of defense against cross-site state-changing requests.
 *
 * Behavior:
 *   - GET / HEAD / OPTIONS → allowed (idempotent)
 *   - POST / PATCH / PUT / DELETE on /api/* → must have Origin
 *     (or Referer) header matching the request's own host
 *   - mismatched origin → 403 with audit log
 */

import { NextResponse, type NextRequest } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function middleware(request: NextRequest) {
  // Idempotent methods — no CSRF risk
  if (SAFE_METHODS.has(request.method)) {
    return NextResponse.next();
  }

  const requestHost = request.headers.get('host');
  if (!requestHost) {
    return NextResponse.next();
  }

  // ดึง Origin หรือ fallback เป็น Referer
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  let sourceHost: string | null = null;
  if (origin) {
    try {
      sourceHost = new URL(origin).host;
    } catch {
      sourceHost = null;
    }
  } else if (referer) {
    try {
      sourceHost = new URL(referer).host;
    } catch {
      sourceHost = null;
    }
  }

  // ไม่มีทั้ง Origin และ Referer — block (modern browser ส่งอย่างน้อย 1 อย่างเสมอ
  // บน state-changing request) เพื่อกัน server-to-server abuse ที่ไม่ได้ผ่าน UI
  if (!sourceHost) {
    return NextResponse.json(
      {
        success: false,
        error: 'CSRF_ORIGIN_MISSING',
        message: 'คำขอไม่มีข้อมูลแหล่งที่มา',
      },
      { status: 403 },
    );
  }

  // เปรียบเทียบแบบ case-insensitive (host ใน HTTP เป็น case-insensitive)
  if (sourceHost.toLowerCase() !== requestHost.toLowerCase()) {
    return NextResponse.json(
      {
        success: false,
        error: 'CSRF_ORIGIN_MISMATCH',
        message: 'คำขอจากแหล่งที่มาไม่ตรงกัน',
      },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

// จำกัดให้ middleware รันเฉพาะ /api/* เท่านั้น
// (page routes ใช้ SameSite cookie + CSP เป็นการป้องกันหลักอยู่แล้ว)
export const config = {
  matcher: ['/api/:path*'],
};
