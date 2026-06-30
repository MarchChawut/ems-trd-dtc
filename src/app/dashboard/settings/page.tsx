/**
 * ==================================================
 * Settings Page - หน้าตั้งค่า
 * ==================================================
 * จัดการ passkey (กุญแจผ่าน) สำหรับเข้าสู่ระบบแบบไม่ใช้รหัสผ่าน
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  startRegistration,
  WebAuthnError,
} from '@simplewebauthn/browser';
import { Fingerprint, Plus, Trash2, Loader2, ShieldCheck, KeyRound, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** ข้อมูล passkey ที่แสดงในรายการ */
interface Passkey {
  id: number;
  name: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function SettingsPage() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // สถานะ 2FA
  const [twoFA, setTwoFA] = useState<{ enabled: boolean; backupCodesRemaining: number } | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  /** โหลดรายการ passkey */
  const loadPasskeys = async () => {
    try {
      const res = await fetch('/api/auth/passkey');
      const data = await res.json();
      if (res.ok && data.success) {
        setPasskeys(data.data);
      }
    } catch {
      setMessage({ type: 'error', text: 'ไม่สามารถโหลดรายการ passkey ได้' });
    } finally {
      setIsLoading(false);
    }
  };

  /** โหลดสถานะ 2FA */
  const load2FA = async () => {
    try {
      const res = await fetch('/api/auth/2fa');
      const data = await res.json();
      if (res.ok && data.success) setTwoFA(data.data);
    } catch {
      /* เงียบไว้ ไม่บล็อกหน้า */
    }
  };

  useEffect(() => {
    loadPasskeys();
    load2FA();
  }, []);

  /** สร้างรหัสสำรองใหม่ (ต้องยืนยันด้วยรหัส TOTP ปัจจุบัน) */
  const handleRegenerateBackupCodes = async () => {
    const code = window.prompt('กรอกรหัส 6 หลักจากแอป authenticator เพื่อยืนยัน');
    if (!code) return;
    setMessage(null);
    setNewBackupCodes([]);
    setRegenerating(true);
    try {
      const res = await fetch('/api/auth/2fa/backup-codes/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'ไม่สำเร็จ');
      setNewBackupCodes(data.data.backupCodes || []);
      setMessage({ type: 'success', text: 'สร้างรหัสสำรองใหม่สำเร็จ (รหัสเดิมถูกยกเลิกแล้ว)' });
      await load2FA();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' });
    } finally {
      setRegenerating(false);
    }
  };

  const copyNewCodes = async () => {
    await navigator.clipboard.writeText(newBackupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /** ลงทะเบียน passkey ใหม่ */
  const handleAddPasskey = async () => {
    setMessage(null);
    setIsRegistering(true);
    try {
      // 1) ขอ options จาก server
      const optRes = await fetch('/api/auth/passkey/register/options', { method: 'POST' });
      const optData = await optRes.json();
      if (!optRes.ok || !optData.success) {
        throw new Error(optData.message || 'ไม่สามารถเริ่มลงทะเบียนได้');
      }

      // 2) เรียก authenticator ของอุปกรณ์
      const attResp = await startRegistration({ optionsJSON: optData.data });

      // 3) ตั้งชื่อ passkey (ไม่บังคับ)
      const name = window.prompt('ตั้งชื่อ passkey นี้ (เช่น MacBook Touch ID)', '') || undefined;

      // 4) ส่งผลให้ server ตรวจสอบและบันทึก
      const verifyRes = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: attResp, name }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.message || 'ไม่สามารถยืนยัน passkey ได้');
      }

      setMessage({ type: 'success', text: 'ลงทะเบียน passkey สำเร็จ' });
      await loadPasskeys();
    } catch (err) {
      // ผู้ใช้กดยกเลิกบน prompt ของอุปกรณ์
      if (err instanceof WebAuthnError && err.code === 'ERROR_CEREMONY_ABORTED') {
        setMessage({ type: 'error', text: 'การลงทะเบียนถูกยกเลิก' });
      } else {
        setMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลงทะเบียน',
        });
      }
    } finally {
      setIsRegistering(false);
    }
  };

  /** ลบ passkey */
  const handleDelete = async (id: number) => {
    if (!window.confirm('ต้องการลบ passkey นี้ใช่หรือไม่?')) return;
    setMessage(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/auth/passkey/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'ไม่สามารถลบ passkey ได้');
      }
      setMessage({ type: 'success', text: 'ลบ passkey สำเร็จ' });
      await loadPasskeys();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบ',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* ส่วน 2FA */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-start gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-800">การยืนยันตัวตนสองชั้น (2FA)</h2>
            <p className="text-sm text-slate-500 mt-1">
              ระบบบังคับใช้ 2FA กับการเข้าสู่ระบบด้วยรหัสผ่านทุกบัญชี
              {twoFA && (
                <>
                  {' '}สถานะ:{' '}
                  <span className={twoFA.enabled ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                    {twoFA.enabled ? 'เปิดใช้งานแล้ว' : 'ยังไม่ได้ตั้งค่า'}
                  </span>
                  {twoFA.enabled && ` · รหัสสำรองเหลือ ${twoFA.backupCodesRemaining} ชุด`}
                </>
              )}
            </p>
          </div>
          {twoFA?.enabled && (
            <button
              onClick={handleRegenerateBackupCodes}
              disabled={regenerating}
              className={cn(
                'flex items-center gap-2 bg-white text-emerald-700 text-sm font-medium px-4 py-2.5 rounded-lg border border-emerald-200 shrink-0',
                'hover:bg-emerald-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
              )}
            >
              {regenerating ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
              <span>สร้างรหัสสำรองใหม่</span>
            </button>
          )}
        </div>

        {newBackupCodes.length > 0 && (
          <div className="p-6 border-b border-slate-100">
            <p className="text-sm text-slate-500 mb-3">
              รหัสสำรองชุดใหม่ (แสดงครั้งเดียว เก็บไว้ในที่ปลอดภัย):
            </p>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-sm text-slate-700">
              {newBackupCodes.map((c) => (
                <span key={c} className="text-center">{c}</span>
              ))}
            </div>
            <button
              onClick={copyNewCodes}
              className="mt-3 flex items-center justify-center gap-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg py-2 px-4 hover:bg-indigo-50 transition-colors"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกรหัสทั้งหมด'}</span>
            </button>
          </div>
        )}
      </div>

      {/* หัวข้อส่วน passkey */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-start gap-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
            <Fingerprint size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-800">Passkey (กุญแจผ่าน)</h2>
            <p className="text-sm text-slate-500 mt-1">
              เข้าสู่ระบบด้วยลายนิ้วมือ ใบหน้า หรือ PIN ของอุปกรณ์ โดยไม่ต้องกรอกรหัสผ่าน
              คุณยังคงเข้าสู่ระบบด้วยรหัสผ่านได้ตามปกติ
            </p>
          </div>
          <button
            onClick={handleAddPasskey}
            disabled={isRegistering}
            className={cn(
              'flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg shrink-0',
              'hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200',
              'disabled:bg-indigo-400 disabled:cursor-not-allowed'
            )}
          >
            {isRegistering ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Plus size={18} />
            )}
            <span>เพิ่ม passkey</span>
          </button>
        </div>

        {/* ข้อความแจ้งผล */}
        {message && (
          <div
            className={cn(
              'mx-6 mt-4 p-3 rounded-lg text-sm',
              message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border border-rose-200 text-rose-600'
            )}
          >
            {message.text}
          </div>
        )}

        {/* รายการ passkey */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : passkeys.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <ShieldCheck size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">ยังไม่มี passkey กดปุ่ม &quot;เพิ่ม passkey&quot; เพื่อเริ่มต้น</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {passkeys.map((pk) => (
                <li
                  key={pk.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 shrink-0">
                    <Fingerprint size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">
                      {pk.name || 'Passkey'}
                    </p>
                    <p className="text-xs text-slate-400">
                      เพิ่มเมื่อ {formatDate(pk.createdAt)}
                      {pk.lastUsedAt && ` · ใช้ล่าสุด ${formatDate(pk.lastUsedAt)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(pk.id)}
                    disabled={deletingId === pk.id}
                    className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50"
                    title="ลบ passkey"
                  >
                    {deletingId === pk.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
