/**
 * ==================================================
 * Login Page - หน้าเข้าสู่ระบบ
 * ==================================================
 * หน้า login สำหรับผู้ใช้งานระบบ EMS
 * มีการตรวจสอบความถูกต้องของข้อมูลและแสดงข้อผิดพลาด
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Eye, EyeOff, Loader2, Fingerprint } from 'lucide-react';
import { startAuthentication, WebAuthnError } from '@simplewebauthn/browser';
import { cn } from '@/lib/utils';

/**
 * หน้าเข้าสู่ระบบ
 * แสดงฟอร์มสำหรับผู้ใช้ป้อน username และ password
 */
export default function LoginPage() {
  const router = useRouter();
  
  // State สำหรับเก็บข้อมูลฟอร์ม
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  
  // State สำหรับแสดง/ซ่อนรหัสผ่าน
  const [showPassword, setShowPassword] = useState(false);
  
  // State สำหรับสถานะการส่งฟอร์ม
  const [isLoading, setIsLoading] = useState(false);

  // State สำหรับสถานะการเข้าสู่ระบบด้วย passkey
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  // State สำหรับข้อผิดพลาด
  const [error, setError] = useState<string | null>(null);

  /**
   * ฟังก์ชันจัดการการเปลี่ยนแปลงข้อมูลในฟอร์ม
   * @param e - React ChangeEvent
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // ล้างข้อผิดพลาดเมื่อผู้ใช้เริ่มพิมพ์
    if (error) setError(null);
  };

  /**
   * ฟังก์ชันจัดการการส่งฟอร์ม
   * @param e - React FormEvent
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ตรวจสอบข้อมูลเบื้องต้น
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // ส่งข้อมูลไปยัง API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // จัดการข้อผิดพลาดตามประเภท
        switch (data.error) {
          case 'TOO_MANY_ATTEMPTS':
            throw new Error(data.message || 'คุณพยายามเข้าสู่ระบบผิดพลาดหลายครั้ง กรุณาลองใหม่ในอีก 30 นาที');
          case 'INVALID_CREDENTIALS':
            throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
          case 'ACCOUNT_DISABLED':
            throw new Error('บัญชีของคุณถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
          default:
            throw new Error(data.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        }
      }
      
      // เข้าสู่ระบบสำเร็จ - ไปยังหน้าแดชบอร์ด
      router.push('/dashboard');
      router.refresh();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่คาดคิด');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ฟังก์ชันเข้าสู่ระบบด้วย passkey
   * ต้องระบุ username ก่อน เพื่อให้ server หา passkey ที่ลงทะเบียนไว้
   */
  const handlePasskeyLogin = async () => {
    if (!formData.username.trim()) {
      setError('กรุณากรอกชื่อผู้ใช้ก่อนเข้าสู่ระบบด้วย passkey');
      return;
    }

    setIsPasskeyLoading(true);
    setError(null);

    try {
      // 1) ขอ options จาก server
      const optRes = await fetch('/api/auth/passkey/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username }),
      });
      const optData = await optRes.json();
      if (!optRes.ok || !optData.success) {
        throw new Error(optData.message || 'ไม่พบ passkey สำหรับผู้ใช้นี้');
      }

      // 2) เรียก authenticator ของอุปกรณ์
      const authResp = await startAuthentication({ optionsJSON: optData.data });

      // 3) ส่งผลให้ server ตรวจสอบและสร้าง session
      const verifyRes = await fetch('/api/auth/passkey/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authResp }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.message || 'ไม่สามารถยืนยัน passkey ได้');
      }

      // เข้าสู่ระบบสำเร็จ
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      if (err instanceof WebAuthnError && err.code === 'ERROR_CEREMONY_ABORTED') {
        setError('การเข้าสู่ระบบด้วย passkey ถูกยกเลิก');
      } else {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย passkey');
      }
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card หลัก */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-indigo-600 p-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Briefcase className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white">EMS Admin</h1>
            <p className="text-indigo-200 text-sm mt-2">
              ระบบบันทึกและจัดการพนักงาน
            </p>
          </div>
          
          {/* ฟอร์มเข้าสู่ระบบ */}
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* ช่องกรอกชื่อผู้ใช้ */}
              <div>
                <label 
                  htmlFor="username" 
                  className="block text-sm font-medium text-slate-700 mb-2"
                >
                  ชื่อผู้ใช้
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  disabled={isLoading}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg border outline-none transition-all",
                    "focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
                    "disabled:bg-slate-100 disabled:cursor-not-allowed",
                    error 
                      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500" 
                      : "border-slate-300"
                  )}
                  placeholder="กรอกชื่อผู้ใช้"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              
              {/* ช่องกรอกรหัสผ่าน */}
              <div>
                <label 
                  htmlFor="password" 
                  className="block text-sm font-medium text-slate-700 mb-2"
                >
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={cn(
                      "w-full px-4 py-3 rounded-lg border outline-none transition-all pr-12",
                      "focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
                      "disabled:bg-slate-100 disabled:cursor-not-allowed",
                      error 
                        ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500" 
                        : "border-slate-300"
                    )}
                    placeholder="กรอกรหัสผ่าน"
                    autoComplete="current-password"
                  />
                  {/* ปุ่มแสดง/ซ่อนรหัสผ่าน */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              
              {/* แสดงข้อผิดพลาด */}
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                  <p className="text-sm text-rose-600 text-center">{error}</p>
                </div>
              )}
              
              {/* ปุ่มเข้าสู่ระบบ */}
              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg",
                  "hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                  "transition-all duration-200 shadow-lg shadow-indigo-200",
                  "disabled:bg-indigo-400 disabled:cursor-not-allowed disabled:shadow-none",
                  "flex items-center justify-center gap-2"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>กำลังเข้าสู่ระบบ...</span>
                  </>
                ) : (
                  <span>เข้าสู่ระบบ</span>
                )}
              </button>

              {/* ตัวคั่น */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">หรือ</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* ปุ่มเข้าสู่ระบบด้วย passkey */}
              <button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={isPasskeyLoading || isLoading}
                className={cn(
                  "w-full bg-white text-indigo-600 font-semibold py-3 rounded-lg border border-indigo-200",
                  "hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                  "transition-all duration-200",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                {isPasskeyLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Fingerprint className="w-5 h-5" />
                )}
                <span>เข้าสู่ระบบด้วย passkey</span>
              </button>
            </form>
            
            {/* ข้อมูลเพิ่มเติม */}
            <div className="mt-6 text-center">
              <p className="text-xs text-slate-400">
                หากลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ
              </p>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} EMS Admin. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
