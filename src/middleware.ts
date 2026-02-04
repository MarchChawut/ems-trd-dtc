/**
 * ==================================================
 * Next.js Middleware - ระบบกลางสำหรับจัดการ request
 * ==================================================
 * ไฟล์นี้ทำงานก่อนทุก request เพื่อตรวจสอบความปลอดภัย
 * และจัดการการเข้าถึงหน้าต่างๆ
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * รายการ paths ที่ไม่ต้องตรวจสอบการเข้าสู่ระบบ
 */
const publicPaths = [
  '/',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/_next',
  '/favicon.ico',
];

/**
 * รายการ paths ที่เป็น API ภายนอก (ไม่ต้องตรวจสอบ)
 */
const apiPaths = ['/api/'];

/**
 * Middleware function
 * ทำงานก่อนทุก request
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ============================================
  // 1. ข้ามการตรวจสอบสำหรับ public paths
  // ============================================
  if (publicPaths.some(path => pathname === path || pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // ============================================
  // 2. เพิ่ม Security Headers ทุก response
  // ============================================
  const response = NextResponse.next();

  // Security Headers เพิ่มเติม (นอกเหนือจากที่ตั้งใน next.config.js)
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  // ============================================
  // 3. ตรวจสอบ CSRF Token สำหรับ API requests (ถ้ามี)
  // ============================================
  if (pathname.startsWith('/api/') && request.method !== 'GET') {
    // ตรวจสอบ Origin header
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    
    if (origin && !origin.includes(host || '')) {
      // อาจเป็น CSRF attack
      console.warn('⚠️ ตรวจพบ Cross-Origin Request:', { origin, host, pathname });
      
      // ใน production อาจจะบล็อก request นี้
      // return NextResponse.json(
      //   { success: false, error: 'INVALID_ORIGIN', message: 'Origin ไม่ถูกต้อง' },
      //   { status: 403 }
      // );
    }
  }

  // ============================================
  // 4. Rate Limiting สำหรับ API (Simple in-memory)
  // ============================================
  // หมายเหตุ: ใน production ควรใช้ Redis หรือ external service
  
  return response;
}

/**
 * กำหนด paths ที่ middleware จะทำงาน
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
