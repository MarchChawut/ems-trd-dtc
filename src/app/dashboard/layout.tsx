/**
 * ==================================================
 * Dashboard Layout - โครงสร้างหลักของหน้า Dashboard
 * ==================================================
 * Server Component: ตรวจสอบ session ครั้งเดียวฝั่ง server (ไม่ต้องยิง
 * /api/auth/session จากฝั่ง client) แล้วส่ง user ลงไปให้ทุกหน้าผ่าน
 * UserContext เพื่อไม่ให้แต่ละหน้าต้อง fetch session ซ้ำเอง
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { UserProvider } from '@/contexts/UserContext';
import DashboardShell from '@/components/dashboard/DashboardShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/');
  }

  return (
    <UserProvider user={user}>
      <DashboardShell user={user}>{children}</DashboardShell>
    </UserProvider>
  );
}
