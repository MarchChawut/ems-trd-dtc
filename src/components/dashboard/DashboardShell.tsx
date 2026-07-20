/**
 * ==================================================
 * Dashboard Shell - Sidebar และ Header (Client Component)
 * ==================================================
 * ส่วนที่ต้องมี interactivity ของ dashboard layout (ย่อ/ขยาย sidebar, เมนูมือถือ)
 * แยกออกมาจาก dashboard/layout.tsx เพื่อให้ layout เป็น Server Component ได้
 * (ดึง user ครั้งเดียวฝั่ง server แล้วส่ง user ลงมาเป็น prop)
 */

'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Calendar,
  Layout,
  LogOut,
  CheckCircle,
  Briefcase,
  Menu,
  X,
  Package,
  Monitor,
  Settings,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SessionUser } from '@/types';

/**
 * ข้อมูลเมนูใน Sidebar
 */
const menuItems = [
  {
    id: 'dashboard',
    label: 'หน้าหลัก',
    icon: Layout,
    href: '/dashboard',
  },
  {
    id: 'tasks',
    label: 'ติดตามงาน',
    icon: CheckCircle,
    href: '/dashboard/tasks',
  },
  {
    id: 'leaves',
    label: 'การลา',
    icon: Calendar,
    href: '/dashboard/leaves',
  },
  {
    id: 'employees',
    label: 'พนักงาน',
    icon: Users,
    href: '/dashboard/employees',
  },
  {
    id: 'supplies',
    label: 'วัสดุ',
    icon: Package,
    href: '/dashboard/supplies',
  },
  {
    id: 'assets',
    label: 'ครุภัณฑ์',
    icon: Monitor,
    href: '/dashboard/assets',
  },
  {
    id: 'documents',
    label: 'หนังสือเข้า-ออก',
    icon: Inbox,
    href: '/dashboard/documents',
  },
  {
    id: 'settings',
    label: 'ตั้งค่า',
    icon: Settings,
    href: '/dashboard/settings',
  },
];

export default function DashboardShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // State สำหรับเปิด/ปิด Sidebar (บนมือถือ)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // State สำหรับย่อ/ขยาย Sidebar (บน desktop)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  /**
   * ฟังก์ชันออกจากระบบ
   */
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // หาเมนูปัจจุบัน
  const isMenuActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
  const currentMenuItem = menuItems.find((item) => isMenuActive(item.href));
  const pageTitle = currentMenuItem?.label || 'แดชบอร์ด';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Desktop */}
      <aside
        className={cn(
          "bg-white border-r border-slate-200 transition-all duration-300",
          "hidden md:flex flex-col fixed h-full z-20 shadow-sm",
          isSidebarCollapsed ? 'w-20' : 'w-20 lg:w-64'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-slate-100 px-4 bg-slate-50">
          <div className="flex items-center gap-2 font-bold text-xl text-indigo-600">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
              <Briefcase size={20} />
            </div>
            <span className={cn("whitespace-nowrap", isSidebarCollapsed ? "hidden" : "hidden lg:inline")}>
              EMS Admin
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = isMenuActive(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all",
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                )}
                title={item.label}
              >
                <item.icon size={20} className="shrink-0" />
                <span className={cn("whitespace-nowrap", isSidebarCollapsed ? "hidden" : "hidden lg:inline")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
              "text-rose-500 hover:bg-rose-50 transition-colors"
            )}
            title="ออกจากระบบ"
          >
            <LogOut size={20} className="shrink-0" />
            <span className={cn("whitespace-nowrap", isSidebarCollapsed ? "hidden" : "hidden lg:inline")}>
              ออกจากระบบ
            </span>
          </button>
        </div>
      </aside>

      {/* Sidebar - Mobile (Overlay) */}
      {isSidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />

          {/* Sidebar */}
          <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-40 md:hidden flex flex-col shadow-xl">
            {/* Logo */}
            <div className="h-16 flex items-center justify-between border-b border-slate-100 px-4 bg-slate-50">
              <div className="flex items-center gap-2 font-bold text-xl text-indigo-600">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
                  <Briefcase size={20} />
                </div>
                <span>EMS Admin</span>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
              {menuItems.map((item) => {
                const isActive = isMenuActive(item.href);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setIsSidebarOpen(false)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all",
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-slate-100">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
              >
                <LogOut size={20} />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          "md:ml-20",
          !isSidebarCollapsed && "lg:ml-64"
        )}
      >
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md bg-white/90">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors md:hidden"
            >
              <Menu size={20} />
            </button>

            {/* Desktop Sidebar Toggle */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden md:block p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            >
              <Menu size={20} />
            </button>

            {/* Page Title */}
            <h1 className="text-lg font-semibold text-slate-700">
              {pageTitle}
            </h1>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-700">{user.name}</p>
              <p className="text-xs text-slate-400 capitalize">{user.role}</p>
            </div>
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
              {user.avatar || user.name.charAt(0)}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
