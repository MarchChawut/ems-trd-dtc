'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Download, Loader2, X, Package,
  AlertTriangle, ChevronDown, FileText, History, Tag, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Supply, SupplyCategory, SupplyTransaction, SupplyType, TransactionType, UserRole } from '@/types';

// ============================================
// Config
// ============================================

const SUPPLY_TYPE_LABELS: Record<SupplyType, string> = {
  STOCK: 'คงคลัง',
  NON_STOCK: 'ไม่คงคลัง',
};

const TX_TYPE_LABELS: Record<TransactionType, { label: string; color: string }> = {
  RECEIVE: { label: 'รับเข้า', color: 'text-emerald-600' },
  ISSUE:   { label: 'เบิกจ่าย', color: 'text-rose-600' },
  RETURN:  { label: 'คืน', color: 'text-blue-600' },
  ADJUST:  { label: 'ปรับยอด', color: 'text-amber-600' },
};

// ============================================
// Helpers
// ============================================

function formatDate(d: Date | string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtPrice(n: number | null | undefined) {
  if (n == null) return '-';
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2 });
}

// ============================================
// Document upload helper
// ============================================

async function uploadDocument(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/uploads/document', { method: 'POST', body: fd });
  const data = await res.json();
  return data.success ? data.data.url : null;
}

// ============================================
// Main Page
// ============================================

export default function SuppliesPage() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [categories, setCategories] = useState<SupplyCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SupplyType>('STOCK');
  const [searchQuery, setSearchQuery] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('EMPLOYEE');
  const [error, setError] = useState<string | null>(null);

  // Create/Edit supply modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);
  const [formData, setFormData] = useState(defaultSupplyForm());
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);

  // Transaction modal
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [selectedSupply, setSelectedSupply] = useState<Supply | null>(null);
  const [txForm, setTxForm] = useState(defaultTxForm());
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txDocFile, setTxDocFile] = useState<File | null>(null);

  // History modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySupply, setHistorySupply] = useState<(Supply & { transactions?: SupplyTransaction[] }) | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Category modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catLoading, setCatLoading] = useState(false);

  const canManage = ['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole);

  // ----------------------------------------
  // Fetch
  // ----------------------------------------

  const fetchAll = useCallback(async () => {
    try {
      const [sessionRes, suppliesRes, catsRes] = await Promise.all([
        fetch('/api/auth/session'),
        fetch('/api/supplies'),
        fetch('/api/supply-categories'),
      ]);
      const sessionData = await sessionRes.json();
      const suppliesData = await suppliesRes.json();
      const catsData = await catsRes.json();

      if (sessionData.success) setUserRole(sessionData.data.user.role);
      if (suppliesData.success) setSupplies(suppliesData.data);
      if (catsData.success) setCategories(catsData.data);
    } catch {
      setError('ไม่สามารถดึงข้อมูลได้');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ----------------------------------------
  // Filtered list
  // ----------------------------------------

  const filteredSupplies = supplies.filter(s => {
    if (s.type !== activeTab) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) ||
        (s.supplier || '').toLowerCase().includes(q) ||
        (s.documentNumber || '').toLowerCase().includes(q);
    }
    return true;
  });

  // ----------------------------------------
  // Supply CRUD
  // ----------------------------------------

  function defaultSupplyForm() {
    return {
      name: '', type: 'STOCK' as SupplyType, categoryId: '' as string | number,
      unit: '', minimumQuantity: 0, supplier: '', unitPrice: '' as string | number,
      documentNumber: '', documentUrl: '', notes: '',
    };
  }

  function openCreateModal() {
    setEditingSupply(null);
    setFormData({ ...defaultSupplyForm(), type: activeTab });
    setDocFile(null);
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEditModal(s: Supply) {
    setEditingSupply(s);
    setFormData({
      name: s.name, type: s.type, categoryId: s.categoryId ?? '',
      unit: s.unit ?? '', minimumQuantity: s.minimumQuantity,
      supplier: s.supplier ?? '', unitPrice: s.unitPrice ?? '',
      documentNumber: s.documentNumber ?? '', documentUrl: s.documentUrl ?? '',
      notes: s.notes ?? '',
    });
    setDocFile(null);
    setFormError(null);
    setIsModalOpen(true);
  }

  async function handleSubmitSupply(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      let docUrl = formData.documentUrl || null;
      if (docFile) {
        docUrl = await uploadDocument(docFile);
        if (!docUrl) throw new Error('อัปโหลดเอกสารไม่สำเร็จ');
      }

      const payload = {
        name: formData.name,
        type: formData.type,
        categoryId: formData.categoryId ? Number(formData.categoryId) : null,
        unit: formData.unit || null,
        minimumQuantity: Number(formData.minimumQuantity) || 0,
        supplier: formData.supplier || null,
        unitPrice: formData.unitPrice !== '' ? Number(formData.unitPrice) : null,
        documentNumber: formData.documentNumber || null,
        documentUrl: docUrl,
        notes: formData.notes || null,
      };

      const url = editingSupply ? `/api/supplies/${editingSupply.id}` : '/api/supplies';
      const method = editingSupply ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      if (editingSupply) {
        setSupplies(prev => prev.map(s => s.id === editingSupply.id ? data.data : s));
      } else {
        setSupplies(prev => [...prev, data.data]);
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDeleteSupply(id: number) {
    if (!confirm('ยืนยันการลบพัสดุนี้?')) return;
    const res = await fetch(`/api/supplies/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) setSupplies(prev => prev.filter(s => s.id !== id));
  }

  // ----------------------------------------
  // Transaction
  // ----------------------------------------

  function defaultTxForm() {
    return { type: 'RECEIVE' as TransactionType, quantity: 1, recipientName: '', documentNumber: '', documentUrl: '', notes: '' };
  }

  function openTxModal(s: Supply) {
    setSelectedSupply(s);
    setTxForm(defaultTxForm());
    setTxDocFile(null);
    setTxError(null);
    setIsTxModalOpen(true);
  }

  async function handleSubmitTx(e: React.FormEvent) {
    e.preventDefault();
    setTxLoading(true);
    setTxError(null);
    try {
      let docUrl = txForm.documentUrl || null;
      if (txDocFile) {
        docUrl = await uploadDocument(txDocFile);
        if (!docUrl) throw new Error('อัปโหลดเอกสารไม่สำเร็จ');
      }

      const res = await fetch('/api/supply-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplyId: selectedSupply!.id,
          type: txForm.type,
          quantity: Number(txForm.quantity),
          recipientName: txForm.recipientName || null,
          documentNumber: txForm.documentNumber || null,
          documentUrl: docUrl,
          notes: txForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      // อัปเดต currentQuantity ใน local state
      if (data.data?.supply) {
        setSupplies(prev => prev.map(s =>
          s.id === selectedSupply!.id ? { ...s, currentQuantity: data.data.supply.currentQuantity } : s
        ));
      }
      setIsTxModalOpen(false);
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setTxLoading(false);
    }
  }

  // ----------------------------------------
  // History
  // ----------------------------------------

  async function openHistory(s: Supply) {
    setHistorySupply(s);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/supplies/${s.id}`);
      const data = await res.json();
      if (data.success) setHistorySupply(data.data);
    } finally {
      setHistoryLoading(false);
    }
  }

  // ----------------------------------------
  // Categories
  // ----------------------------------------

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    setCatLoading(true);
    try {
      const res = await fetch('/api/supply-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName }),
      });
      const data = await res.json();
      if (data.success) {
        setCategories(prev => [...prev, data.data]);
        setNewCatName('');
      }
    } finally {
      setCatLoading(false);
    }
  }

  async function handleDeleteCategory(id: number) {
    await fetch(`/api/supply-categories?id=${id}`, { method: 'DELETE' });
    setCategories(prev => prev.filter(c => c.id !== id));
  }

  // ----------------------------------------
  // Export
  // ----------------------------------------

  function handleExport() {
    const a = document.createElement('a');
    a.href = `/api/supplies/export?type=${activeTab}`;
    a.download = '';
    a.click();
  }

  // ----------------------------------------
  // Render
  // ----------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const lowStockCount = supplies.filter(s => s.type === 'STOCK' && s.currentQuantity <= s.minimumQuantity).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">พัสดุ</h1>
          <p className="text-slate-500 mt-1 text-sm">จัดการพัสดุคงคลังและไม่คงคลัง</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button onClick={() => setIsCatModalOpen(true)} className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 text-sm transition-colors">
              <Settings size={16} /> หมวดหมู่
            </button>
          )}
          {canManage && (
            <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 text-sm transition-colors">
              <Download size={16} /> Export
            </button>
          )}
          {canManage && (
            <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm transition-colors shadow-sm">
              <Plus size={16} /> เพิ่มพัสดุ
            </button>
          )}
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockCount > 0 && activeTab === 'STOCK' && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">มี <strong>{lowStockCount}</strong> รายการที่มีจำนวนต่ำกว่าขั้นต่ำ</p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {(['STOCK', 'NON_STOCK'] as SupplyType[]).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === t
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            {SUPPLY_TYPE_LABELS[t]}
            <span className={cn('ml-2 px-2 py-0.5 rounded-full text-xs', activeTab === t ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500')}>
              {supplies.filter(s => s.type === t).length}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" placeholder="ค้นหาชื่อ, ผู้จำหน่าย, เลขที่เอกสาร..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <span className="text-sm text-slate-500">{filteredSupplies.length} รายการ</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-3 px-4 font-semibold text-slate-600">ชื่อพัสดุ</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600">หมวดหมู่</th>
                {activeTab === 'STOCK' && (
                  <>
                    <th className="text-center py-3 px-4 font-semibold text-slate-600">คงเหลือ</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-600">ขั้นต่ำ</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-600">สต็อก</th>
                  </>
                )}
                <th className="text-left py-3 px-4 font-semibold text-slate-600">ผู้จำหน่าย</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">ราคา/หน่วย</th>
                {activeTab === 'NON_STOCK' && (
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">เลขที่เอกสาร</th>
                )}
                <th className="text-center py-3 px-4 font-semibold text-slate-600">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSupplies.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    ไม่มีข้อมูลพัสดุ
                  </td>
                </tr>
              ) : filteredSupplies.map(s => {
                const isLow = s.type === 'STOCK' && s.currentQuantity <= s.minimumQuantity;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{s.name}</div>
                      {s.unit && <div className="text-xs text-slate-400">หน่วย: {s.unit}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{(s as any).category?.name || '-'}</td>
                    {s.type === 'STOCK' && (
                      <>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">{s.currentQuantity}</td>
                        <td className="py-3 px-4 text-center text-slate-500">{s.minimumQuantity}</td>
                        <td className="py-3 px-4 text-center">
                          {isLow
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-rose-100 text-rose-700"><AlertTriangle size={10} /> สต็อกต่ำ</span>
                            : <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">ปกติ</span>
                          }
                        </td>
                      </>
                    )}
                    <td className="py-3 px-4 text-slate-600">{s.supplier || '-'}</td>
                    <td className="py-3 px-4 text-right text-slate-700">{fmtPrice(s.unitPrice)}</td>
                    {s.type === 'NON_STOCK' && (
                      <td className="py-3 px-4 text-slate-600">
                        {s.documentNumber
                          ? <span className="flex items-center gap-1">{s.documentNumber}
                            {s.documentUrl && <a href={s.documentUrl} target="_blank" rel="noopener" className="text-indigo-600 hover:underline"><FileText size={14} /></a>}
                          </span>
                          : '-'
                        }
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openHistory(s)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700" title="ประวัติ">
                          <History size={15} />
                        </button>
                        {canManage && s.type === 'STOCK' && (
                          <button onClick={() => openTxModal(s)} className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 text-xs font-medium" title="ทำรายการ">
                            <Tag size={15} />
                          </button>
                        )}
                        {canManage && (
                          <button onClick={() => openEditModal(s)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 text-xs" title="แก้ไข">
                            แก้ไข
                          </button>
                        )}
                        {canManage && (
                          <button onClick={() => handleDeleteSupply(s.id)} className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 text-xs" title="ลบ">
                            ลบ
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Create/Edit Supply Modal ===== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">{editingSupply ? 'แก้ไขพัสดุ' : 'เพิ่มพัสดุใหม่'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmitSupply} className="p-5 space-y-4">
              {formError && <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">{formError}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อพัสดุ *</label>
                  <input required value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="ระบุชื่อพัสดุ" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ประเภท *</label>
                  <select value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value as SupplyType }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="STOCK">คงคลัง</option>
                    <option value="NON_STOCK">ไม่คงคลัง</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">หมวดหมู่</label>
                  <select value={formData.categoryId} onChange={e => setFormData(p => ({ ...p, categoryId: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">-- ไม่ระบุ --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {formData.type === 'STOCK' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">หน่วยนับ</label>
                      <input value={formData.unit} onChange={e => setFormData(p => ({ ...p, unit: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="เช่น ชิ้น, กล่อง" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">จำนวนขั้นต่ำ</label>
                      <input type="number" min="0" value={formData.minimumQuantity} onChange={e => setFormData(p => ({ ...p, minimumQuantity: Number(e.target.value) }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ผู้จำหน่าย</label>
                  <input value={formData.supplier} onChange={e => setFormData(p => ({ ...p, supplier: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="ชื่อบริษัท/ร้าน" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ราคา/หน่วย (บาท)</label>
                  <input type="number" min="0" step="0.01" value={formData.unitPrice} onChange={e => setFormData(p => ({ ...p, unitPrice: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">เลขที่เอกสารรับ</label>
                  <input value={formData.documentNumber} onChange={e => setFormData(p => ({ ...p, documentNumber: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="เลขที่เอกสาร" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ไฟล์เอกสาร (PDF/รูป)</label>
                  <input type="file" accept=".pdf,image/*" onChange={e => setDocFile(e.target.files?.[0] || null)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
                  {formData.documentUrl && !docFile && (
                    <a href={formData.documentUrl} target="_blank" rel="noopener" className="text-xs text-indigo-600 hover:underline mt-1 flex items-center gap-1">
                      <FileText size={12} /> ดูเอกสารเดิม
                    </a>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">หมายเหตุ</label>
                  <textarea rows={2} value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 text-sm">ยกเลิก</button>
                <button type="submit" disabled={formLoading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm disabled:bg-indigo-400 flex items-center justify-center gap-2">
                  {formLoading && <Loader2 size={14} className="animate-spin" />}
                  {editingSupply ? 'บันทึก' : 'สร้างพัสดุ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Transaction Modal ===== */}
      {isTxModalOpen && selectedSupply && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-800">ทำรายการพัสดุ</h2>
                <p className="text-sm text-slate-500">{selectedSupply.name} — คงเหลือ <strong>{selectedSupply.currentQuantity}</strong> {selectedSupply.unit || ''}</p>
              </div>
              <button onClick={() => setIsTxModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmitTx} className="p-5 space-y-4">
              {txError && <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">{txError}</div>}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ประเภทรายการ *</label>
                <select value={txForm.type} onChange={e => setTxForm(p => ({ ...p, type: e.target.value as TransactionType }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="RECEIVE">รับเข้า</option>
                  <option value="ISSUE">เบิกจ่าย</option>
                  <option value="RETURN">คืน</option>
                  <option value="ADJUST">ปรับยอด (ตั้งค่าสมบูรณ์)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {txForm.type === 'ADJUST' ? 'จำนวนใหม่' : 'จำนวน'} *
                </label>
                <input required type="number" min="1" value={txForm.quantity} onChange={e => setTxForm(p => ({ ...p, quantity: Number(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              {txForm.type === 'ISSUE' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อผู้รับ</label>
                  <input value={txForm.recipientName} onChange={e => setTxForm(p => ({ ...p, recipientName: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="ระบุชื่อผู้รับพัสดุ" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">เลขที่เอกสาร</label>
                  <input value={txForm.documentNumber} onChange={e => setTxForm(p => ({ ...p, documentNumber: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="เลขที่" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ไฟล์แนบ (PDF)</label>
                  <input type="file" accept=".pdf,image/*" onChange={e => setTxDocFile(e.target.files?.[0] || null)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">หมายเหตุ</label>
                <textarea rows={2} value={txForm.notes} onChange={e => setTxForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsTxModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 text-sm">ยกเลิก</button>
                <button type="submit" disabled={txLoading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm disabled:bg-indigo-400 flex items-center justify-center gap-2">
                  {txLoading && <Loader2 size={14} className="animate-spin" />}
                  บันทึกรายการ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== History Modal ===== */}
      {isHistoryOpen && historySupply && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-800">ประวัติ — {historySupply.name}</h2>
                {historySupply.type === 'STOCK' && (
                  <p className="text-sm text-slate-500">คงเหลือ: <strong>{historySupply.currentQuantity}</strong> {historySupply.unit || ''}</p>
                )}
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {historyLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-indigo-600 w-6 h-6" /></div>
              ) : !(historySupply as any).transactions?.length ? (
                <p className="text-center text-slate-400 py-8">ยังไม่มีประวัติการเคลื่อนไหว</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 font-semibold text-slate-600">วันที่</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-600">ประเภท</th>
                      <th className="text-center py-2 px-3 font-semibold text-slate-600">จำนวน</th>
                      <th className="text-center py-2 px-3 font-semibold text-slate-600">ก่อน→หลัง</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-600">ผู้รับ/ผู้ทำรายการ</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-600">เอกสาร</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(historySupply as any).transactions.map((tx: SupplyTransaction) => (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-500">{formatDate(tx.createdAt)}</td>
                        <td className="py-2 px-3">
                          <span className={cn('font-medium text-sm', TX_TYPE_LABELS[tx.type]?.color)}>
                            {TX_TYPE_LABELS[tx.type]?.label}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-semibold">{tx.quantity}</td>
                        <td className="py-2 px-3 text-center text-slate-500">{tx.quantityBefore} → {tx.quantityAfter}</td>
                        <td className="py-2 px-3 text-slate-600">
                          {tx.recipientName && <div className="text-xs">{tx.recipientName}</div>}
                          <div className="text-xs text-slate-400">{(tx.performedBy as any)?.name}</div>
                        </td>
                        <td className="py-2 px-3">
                          {tx.documentNumber && <div className="text-xs text-slate-600">{tx.documentNumber}</div>}
                          {tx.documentUrl && <a href={tx.documentUrl} target="_blank" rel="noopener" className="text-xs text-indigo-600 hover:underline flex items-center gap-1"><FileText size={12} /> เปิดไฟล์</a>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Category Modal ===== */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">จัดการหมวดหมู่พัสดุ</h2>
              <button onClick={() => setIsCatModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input required value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="ชื่อหมวดหมู่ใหม่"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button type="submit" disabled={catLoading} className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm disabled:bg-indigo-400">
                  {catLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
                </button>
              </form>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50">
                    <span className="text-sm text-slate-700">{c.name}</span>
                    <button onClick={() => handleDeleteCategory(c.id)} className="text-xs text-slate-400 hover:text-rose-600">ลบ</button>
                  </div>
                ))}
                {categories.length === 0 && <p className="text-sm text-slate-400 text-center py-4">ยังไม่มีหมวดหมู่</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
