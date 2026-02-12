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
  '/api/health', // Health check ไม่ต้องตรวจสอบ
  '/_next',
  '/favicon.ico',
];

/**
 * Allowed Origins สำหรับ CORS
 * ใน production ควรระบุ domain ที่ชัดเจน
 */
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'https://localhost:3000',
];

/**
 * ตรวจสอบว่า origin อยู่ใน allowed list
 */
function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.some(allowed => {
    // Support wildcard patterns like https://*.example.com
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\./g, '\\.').replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    }
    return origin === allowed;
  });
}

/**
 * Middleware function
 * ทำงานก่อนทุก request
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');

  // ============================================
  // 1. ข้ามการตรวจสอบสำหรับ public paths
  // ============================================
  if (publicPaths.some(path => pathname === path || pathname.startsWith(path))) {
    const response = NextResponse.next();
    
    // Add CORS headers for API requests
    if (pathname.startsWith('/api/')) {
      addCorsHeaders(response, origin);
    }
    
    return response;
  }

  // ============================================
  // 2. HTTPS Redirect สำหรับ Production
  // ============================================
  if (process.env.NODE_ENV === 'production' && !request.headers.get('x-forwarded-proto')?.includes('https')) {
    // Skip if behind reverse proxy that handles HTTPS
    if (!request.headers.get('x-forwarded-for')) {
      const httpsUrl = new URL(request.url);
      httpsUrl.protocol = 'https:';
      return NextResponse.redirect(httpsUrl, 301);
    }
  }

  // ============================================
  // 3. CORS Check สำหรับ API requests
  // ============================================
  if (pathname.startsWith('/api/')) {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 });
      addCorsHeaders(response, origin);
      return response;
    }
    
    // Check origin for non-GET requests
    if (request.method !== 'GET' && origin) {
      if (!isAllowedOrigin(origin)) {
        return NextResponse.json(
          { success: false, error: 'INVALID_ORIGIN', message: 'Origin not allowed' },
          { status: 403 }
        );
      }
    }
  }

  // ============================================
  // 4. เพิ่ม Security Headers ทุก response
  // ============================================
  const response = NextResponse.next();

  // Security Headers
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

  // Add CORS headers
  addCorsHeaders(response, origin);

  return response;
}

/**
 * เพิ่ม CORS headers ให้กับ response
 */
function addCorsHeaders(response: NextResponse, origin: string | null): void {
  // Set CORS headers
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400');
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
