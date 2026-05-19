/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production';

// CSP policy — แยก dev/prod
// - dev: ต้องมี 'unsafe-eval' สำหรับ Next.js HMR + React Refresh
// - prod: ลบ 'unsafe-eval' ออก ('unsafe-inline' ยังจำเป็นสำหรับ Next.js bootstrap)
// TODO V.2.0: refactor เป็น nonce-based CSP เพื่อลบ 'unsafe-inline' ออก
const scriptSrc = isDev
  ? "'self' 'unsafe-eval' 'unsafe-inline'"
  : "'self' 'unsafe-inline'";

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig = {
  // ❗ ห้ามใส่ secret (DATABASE_URL, NEXTAUTH_SECRET) ใน `env` block —
  // Next.js จะ inline ค่าเข้า client bundle → leak ผ่าน DevTools
  // Server code ใช้ process.env.* ได้โดยตรงอยู่แล้ว
  // ถ้าต้องการ expose ตัวแปรไปฝั่ง client ใช้ prefix `NEXT_PUBLIC_` แทน

  // การตั้งค่าความปลอดภัย
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
  // ปิดการใช้งาน powered by header เพื่อความปลอดภัย
  poweredByHeader: false,
  // Turbopack config สำหรับ @react-pdf/renderer (Next.js 16+)
  turbopack: {
    resolveAlias: {
      canvas: './empty-module.js',
    },
  },
  // webpack config สำหรับ @react-pdf/renderer (fallback ถ้าใช้ --webpack)
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
