/** @type {import('next').NextConfig} */
const nextConfig = {
  // การตั้งค่าสำหรับการเชื่อมต่อ MariaDB บน Synology NAS
  env: {
    // ตัวแปรสภาพแวดล้อมสำหรับการเชื่อมต่อฐานข้อมูล
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
  // การตั้งค่าความปลอดภัย
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com;",
          },
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
