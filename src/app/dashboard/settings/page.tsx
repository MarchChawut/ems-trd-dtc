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
import { Fingerprint, Plus, Trash2, Loader2, ShieldCheck, KeyRound, Copy, Check, Lock, Users, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';
import { useCurrentUser } from '@/contexts/UserContext';

/** ข้อมูล passkey ที่แสดงในรายการ */
interface Passkey {
  id: number;
  name: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

/** ข้อมูลพนักงานแบบย่อสำหรับส่วนจัดการบัญชี (super admin) */
interface EmployeeAccount {
  id: number;
  name: string;
  username: string;
  role: UserRole;
  isActive: boolean;
}

/** กฎการคำนวณวันลา (ผูกกับปีงบประมาณได้) */
interface LeaveRule {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  fullDayHours: number;
  halfDayHours: number;
  maxConsecutiveDays: number;
  hourThreshold: number;
  halfDayFraction: number;
  fiscalYear: number | null;
  isActive: boolean;
}

export default function SettingsPage() {
  // ผู้ใช้ปัจจุบัน (ใช้กำหนดว่าจะแสดงส่วนเฉพาะ super admin หรือไม่)
  const { role: currentUserRole } = useCurrentUser();

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

  // เปลี่ยนรหัสผ่านด้วยตนเอง
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // จัดการบัญชีผู้ใช้ (super admin เท่านั้น) - ระงับ/เปิดใช้งานการเข้าสู่ระบบของพนักงาน
  const [employees, setEmployees] = useState<EmployeeAccount[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);
  const [accountsMessage, setAccountsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // สูตรคำนวณวันลา (Manager ขึ้นไป) - กฎแยกตามปีงบประมาณ
  const [leaveRules, setLeaveRules] = useState<LeaveRule[]>([]);
  const [loadingLeaveRules, setLoadingLeaveRules] = useState(false);
  const [savingRuleId, setSavingRuleId] = useState<number | null>(null);
  const [creatingRule, setCreatingRule] = useState(false);
  const [leaveRuleMessage, setLeaveRuleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newRuleFiscalYear, setNewRuleFiscalYear] = useState('');

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

  /** โหลดรายชื่อพนักงานทั้งหมด (เฉพาะ super admin) */
  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (res.ok && data.success) setEmployees(data.data);
    } catch {
      setAccountsMessage({ type: 'error', text: 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้' });
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    loadPasskeys();
    load2FA();
  }, []);

  useEffect(() => {
    if (currentUserRole === 'SUPER_ADMIN') {
      loadEmployees();
    }
  }, [currentUserRole]);

  const canManageLeaveRules = ['MANAGER', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(currentUserRole);

  /** โหลดกฎการคำนวณวันลาทั้งหมด (Manager ขึ้นไป) */
  const loadLeaveRules = async () => {
    setLoadingLeaveRules(true);
    try {
      const res = await fetch('/api/leave-rules');
      const data = await res.json();
      if (res.ok && data.success) setLeaveRules(data.data);
    } catch {
      setLeaveRuleMessage({ type: 'error', text: 'ไม่สามารถโหลดกฎการคำนวณวันลาได้' });
    } finally {
      setLoadingLeaveRules(false);
    }
  };

  useEffect(() => {
    if (canManageLeaveRules) {
      loadLeaveRules();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserRole]);

  /** แก้ไขค่าฟิลด์หนึ่งของกฎในหน่วยความจำ (ยังไม่บันทึก) */
  const updateRuleField = (id: number, field: keyof LeaveRule, value: number | boolean) => {
    setLeaveRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  /** บันทึกการแก้ไขกฎการลา */
  const handleSaveRule = async (rule: LeaveRule) => {
    setLeaveRuleMessage(null);
    setSavingRuleId(rule.id);
    try {
      const res = await fetch('/api/leave-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rule.id,
          fullDayHours: rule.fullDayHours,
          halfDayHours: rule.halfDayHours,
          maxConsecutiveDays: rule.maxConsecutiveDays,
          hourThreshold: rule.hourThreshold,
          halfDayFraction: rule.halfDayFraction,
          isActive: rule.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'ไม่สามารถบันทึกกฎการลาได้');
      }
      setLeaveRuleMessage({ type: 'success', text: 'บันทึกกฎการลาสำเร็จ' });
    } catch (err) {
      setLeaveRuleMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
      });
    } finally {
      setSavingRuleId(null);
    }
  };

  /** เพิ่มกฎการลาสำหรับปีงบประมาณใหม่ (คัดลอกค่าเริ่มต้นจากกฎล่าสุด) */
  const handleCreateRule = async () => {
    setLeaveRuleMessage(null);
    const fiscalYear = parseInt(newRuleFiscalYear);
    if (!fiscalYear || fiscalYear < 2000 || fiscalYear > 2100) {
      setLeaveRuleMessage({ type: 'error', text: 'กรุณาระบุปีงบประมาณ (ค.ศ. เช่น 2026) ให้ถูกต้อง' });
      return;
    }
    setCreatingRule(true);
    try {
      const template = leaveRules[0];
      const res = await fetch('/api/leave-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `กฎการลาปีงบประมาณ ${fiscalYear}`,
          fiscalYear,
          fullDayHours: template?.fullDayHours ?? 8,
          halfDayHours: template?.halfDayHours ?? 4,
          maxConsecutiveDays: template?.maxConsecutiveDays ?? 30,
          hourThreshold: template?.hourThreshold ?? 3,
          halfDayFraction: template?.halfDayFraction ?? 0.5,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'ไม่สามารถสร้างกฎการลาได้');
      }
      setLeaveRuleMessage({ type: 'success', text: 'สร้างกฎการลาสำหรับปีงบประมาณใหม่สำเร็จ' });
      setNewRuleFiscalYear('');
      await loadLeaveRules();
    } catch (err) {
      setLeaveRuleMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
      });
    } finally {
      setCreatingRule(false);
    }
  };

  /** ระงับ/เปิดใช้งานบัญชีของพนักงาน */
  const handleToggleActive = async (userId: number, nextActive: boolean) => {
    setAccountsMessage(null);
    setTogglingUserId(userId);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'ไม่สามารถเปลี่ยนสถานะบัญชีได้');
      }
      setEmployees((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: nextActive } : u))
      );
      setAccountsMessage({
        type: 'success',
        text: nextActive ? 'เปิดใช้งานบัญชีสำเร็จ' : 'ระงับการใช้งานบัญชีสำเร็จ',
      });
    } catch (err) {
      setAccountsMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
      });
    } finally {
      setTogglingUserId(null);
    }
  };

  /** เปลี่ยนรหัสผ่านด้วยตนเอง (ต้องกรอกรหัสเดิมเพื่อยืนยัน) */
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน' });
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
      }
      setPasswordMessage({ type: 'success', text: 'เปลี่ยนรหัสผ่านสำเร็จ' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
      });
    } finally {
      setChangingPassword(false);
    }
  };

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
      {/* เปลี่ยนรหัสผ่าน */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-start gap-4">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 shrink-0">
            <Lock size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-800">เปลี่ยนรหัสผ่าน</h2>
            <p className="text-sm text-slate-500 mt-1">
              เปลี่ยนรหัสผ่านของบัญชีตนเอง กรุณากรอกรหัสผ่านเดิมเพื่อยืนยันตัวตน
            </p>
          </div>
        </div>

        {passwordMessage && (
          <div
            className={cn(
              'mx-6 mt-4 p-3 rounded-lg text-sm',
              passwordMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border border-rose-200 text-rose-600'
            )}
          >
            {passwordMessage.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">รหัสผ่านเดิม</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">รหัสผ่านใหม่</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-400 mt-1">อย่างน้อย 8 ตัวอักษร มีตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ และตัวเลข</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">ยืนยันรหัสผ่านใหม่</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={changingPassword}
            className={cn(
              'flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg',
              'hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200',
              'disabled:bg-indigo-400 disabled:cursor-not-allowed'
            )}
          >
            {changingPassword && <Loader2 size={18} className="animate-spin" />}
            <span>เปลี่ยนรหัสผ่าน</span>
          </button>
        </form>
      </div>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-sm text-slate-700">
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

      {/* สูตรคำนวณวันลา (Manager ขึ้นไป) */}
      {canManageLeaveRules && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
              <Calculator size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-800">สูตรคำนวณวันลา</h2>
              <p className="text-sm text-slate-500 mt-1">
                กำหนดเกณฑ์การแปลงชั่วโมงลาเป็นวัน และจำนวนวันลาติดต่อกันสูงสุด แยกตามปีงบประมาณ
                เนื่องจากเกณฑ์อาจเปลี่ยนแปลงในแต่ละปี
              </p>
            </div>
          </div>

          {leaveRuleMessage && (
            <div
              className={cn(
                'mx-6 mt-4 p-3 rounded-lg text-sm',
                leaveRuleMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border border-rose-200 text-rose-600'
              )}
            >
              {leaveRuleMessage.text}
            </div>
          )}

          <div className="p-6 space-y-4">
            {loadingLeaveRules ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : (
              <>
                {leaveRules.map((rule) => (
                  <div key={rule.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-800">
                        {rule.fiscalYear
                          ? `ปีงบประมาณ ${rule.fiscalYear} (พ.ศ. ${rule.fiscalYear + 1 + 543})`
                          : 'ค่าเริ่มต้น (ทุกปีที่ไม่มีกฎเฉพาะ)'}
                      </p>
                      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.isActive}
                          onChange={(e) => updateRuleField(rule.id, 'isActive', e.target.checked)}
                          className="rounded"
                        />
                        ใช้งานอยู่
                      </label>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">
                          ลาชั่วโมงไม่เกิน (ชม.) = ครึ่งวัน
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={rule.hourThreshold}
                          onChange={(e) => updateRuleField(rule.id, 'hourThreshold', parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">สัดส่วน &quot;ครึ่งวัน&quot;</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          value={rule.halfDayFraction}
                          onChange={(e) => updateRuleField(rule.id, 'halfDayFraction', parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">ชม. ทำงาน = 1 วัน</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={rule.fullDayHours}
                          onChange={(e) => updateRuleField(rule.id, 'fullDayHours', parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">ลาติดต่อกันสูงสุด (วัน)</label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          value={rule.maxConsecutiveDays}
                          onChange={(e) => updateRuleField(rule.id, 'maxConsecutiveDays', parseInt(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleSaveRule(rule)}
                      disabled={savingRuleId === rule.id}
                      className={cn(
                        'flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg',
                        'hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed'
                      )}
                    >
                      {savingRuleId === rule.id && <Loader2 size={16} className="animate-spin" />}
                      <span>บันทึก</span>
                    </button>
                  </div>
                ))}

                {/* เพิ่มกฎสำหรับปีงบประมาณใหม่ */}
                <div className="border border-dashed border-slate-300 rounded-xl p-4 flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">
                      เพิ่มกฎสำหรับปีงบประมาณใหม่ (ปี ค.ศ. ที่เริ่ม 1 ต.ค. เช่น 2026)
                    </label>
                    <input
                      type="number"
                      value={newRuleFiscalYear}
                      onChange={(e) => setNewRuleFiscalYear(e.target.value)}
                      placeholder="2026"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm"
                    />
                    {newRuleFiscalYear && !isNaN(parseInt(newRuleFiscalYear)) && (
                      <p className="text-xs text-slate-400 mt-1">
                        = พ.ศ. {parseInt(newRuleFiscalYear) + 1 + 543}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleCreateRule}
                    disabled={creatingRule}
                    className={cn(
                      'flex items-center gap-2 bg-white text-amber-700 text-sm font-medium px-4 py-2 rounded-lg border border-amber-200 shrink-0',
                      'hover:bg-amber-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
                    )}
                  >
                    {creatingRule ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    <span>เพิ่ม</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* จัดการบัญชีผู้ใช้ (เฉพาะ super admin) */}
      {currentUserRole === 'SUPER_ADMIN' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-start gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
              <Users size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-800">จัดการบัญชีผู้ใช้</h2>
              <p className="text-sm text-slate-500 mt-1">
                ระงับหรือเปิดใช้งานการเข้าสู่ระบบของพนักงาน (เฉพาะ Super Admin) — บัญชีที่ถูกระงับจะเข้าสู่ระบบไม่ได้ทุกวิธี
              </p>
            </div>
          </div>

          {accountsMessage && (
            <div
              className={cn(
                'mx-6 mt-4 p-3 rounded-lg text-sm',
                accountsMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border border-rose-200 text-rose-600'
              )}
            >
              {accountsMessage.text}
            </div>
          )}

          <div className="p-6">
            {loadingEmployees ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : (
              <ul className="space-y-2">
                {employees.map((emp) => (
                  <li
                    key={emp.id}
                    className="flex items-center gap-4 p-3 rounded-xl border border-slate-200"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{emp.name}</p>
                      <p className="text-xs text-slate-400">@{emp.username} · {emp.role}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer shrink-0">
                      {togglingUserId === emp.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={emp.isActive}
                          onChange={(e) => handleToggleActive(emp.id, e.target.checked)}
                          className="rounded"
                        />
                      )}
                      <span>{emp.isActive ? 'ใช้งานได้' : 'ถูกระงับ'}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
