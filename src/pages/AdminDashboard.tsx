import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, X, ImageOff, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Pkg, OtherPkg, GameAccount, AccountRequest } from '../lib/api';
import {
  fetchAllPackages,
  fetchAllOtherPackages,
  fetchAllAccounts,
  fetchAccountRequests,
} from '../lib/api';
import { formatEGP } from '../data/store';
import AdminOrders from './AdminOrders';

type Section = 'orders' | 'packages' | 'accounts' | 'requests';

interface AccountDraft {
  id?: string;
  game_id: string;
  server_id: string;
  contact_number: string;
  price: string;
  page: 'customers' | 'store';
  sold: boolean;
  published: boolean;
  photos: string[];
}

const EMPTY_ACCOUNT: AccountDraft = {
  game_id: '',
  server_id: '',
  contact_number: '',
  price: '',
  page: 'customers',
  sold: false,
  published: true,
  photos: [],
};

const ML_TAB_LABELS: Record<string, string> = {
  double: 'باقات مضاعفة',
  basic: 'باقات أساسية',
  bundles: 'حزم واشتراكات',
  other: 'حزم أخرى',
};

export default function AdminAccounts({
  section,
  onNavigate,
}: {
  section: Section;
  onNavigate: (s: Section) => void;
}) {
  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [otherPackages, setOtherPackages] = useState<OtherPkg[]>([]);
  const [draft, setDraft] = useState<AccountDraft | null>(null);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GameAccount | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<AccountRequest | null>(null);
  const [mlTab, setMlTab] = useState<string>('double');
  const [newOther, setNewOther] = useState({ name: '', price: '', note: '', end_date: '' });
  const fileInput = useRef<HTMLInputElement>(null);

  const loadAll = async () => {
    const [acc, req, pkgs, others] = await Promise.all([
      fetchAllAccounts(),
      fetchAccountRequests(),
      fetchAllPackages(),
      fetchAllOtherPackages(),
    ]);
    setAccounts(acc);
    setRequests(req);
    setPackages(pkgs);
    setOtherPackages(others);
  };

  useEffect(() => {
    loadAll().catch(() => undefined);
  }, []);

  // ---------- accounts ----------
  const openNewAccount = (prefill?: Partial<AccountDraft>) => {
    setDraft({ ...EMPTY_ACCOUNT, ...prefill });
    setNewFiles([]);
    setFormError(null);
  };

  const openEditAccount = (a: GameAccount) => {
    setDraft({
      id: a.id,
      game_id: a.game_id,
      server_id: a.server_id,
      contact_number: a.contact_number,
      price: String(a.price),
      page: a.page,
      sold: a.sold,
      published: a.published,
      photos: [...a.photos],
    });
    setNewFiles([]);
    setFormError(null);
  };

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of newFiles) {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from('account-photos')
        .upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('account-photos').getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const deleteStoragePhotos = async (urls: string[]) => {
    for (const url of urls) {
      const marker = '/storage/v1/object/public/account-photos/';
      const idx = url.indexOf(marker);
      if (idx === -1) continue;
      await supabase.storage.from('account-photos').remove([url.slice(idx + marker.length)]);
    }
  };

  const saveAccount = async () => {
    if (!draft) return;
    if (!draft.game_id.trim() || !draft.server_id.trim() || !draft.contact_number.trim() || !draft.price.trim()) {
      setFormError('املأ كل الحقول من فضلك.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const uploaded = await uploadPhotos();
      const photos = [...draft.photos, ...uploaded];
      const row = {
        game_id: draft.game_id.trim(),
        server_id: draft.server_id.trim(),
        contact_number: draft.contact_number.trim(),
        price: Number(draft.price),
        page: draft.page,
        sold: draft.sold,
        published: draft.published,
        photos,
      };
      const original = draft.id ? accounts.find((a) => a.id === draft.id)?.photos ?? [] : [];
      let error;
      if (draft.id) {
        ({ error } = await supabase.from('accounts').update(row).eq('id', draft.id));
      } else {
        ({ error } = await supabase.from('accounts').insert(row));
      }
      if (error) throw error;
      await deleteStoragePhotos(original.filter((u) => !photos.includes(u)));
      setDraft(null);
      setNewFiles([]);
      await loadAll();
    } catch {
      setFormError('حدث خطأ أثناء الحفظ. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSold = async (a: GameAccount) => {
    await supabase.from('accounts').update({ sold: !a.sold }).eq('id', a.id);
    await loadAll();
  };

  const confirmDeleteAccount = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    await supabase.from('accounts').delete().eq('id', target.id);
    await deleteStoragePhotos(target.photos);
    await loadAll();
  };

  const publishRequest = (r: AccountRequest) => {
    openNewAccount({
      game_id: r.game_id,
      server_id: r.server_id,
      contact_number: r.contact_number,
      price: String(r.expected_price),
      photos: [...r.photos],
      page: 'customers',
    });
    setDeleteRequest(r);
  };

  const confirmDeleteRequest = async () => {
    if (!deleteRequest) return;
    const target = deleteRequest;
    setDeleteRequest(null);
    await supabase.from('account_requests').delete().eq('id', target.id);
    await loadAll();
  };

  // ---------- packages ----------
  const setPackagePrice = async (p: Pkg, price: string) => {
    const value = Number(price);
    if (!Number.isFinite(value) || value < 0) return;
    setPackages((prev) => prev.map((x) => (x.id === p.id ? { ...x, price: value } : x)));
    await supabase.from('packages').update({ price: value }).eq('id', p.id);
  };

  const setPackageLabel = async (p: Pkg, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setPackages((prev) => prev.map((x) => (x.id === p.id ? { ...x, label: trimmed } : x)));
    await supabase.from('packages').update({ label: trimmed }).eq('id', p.id);
  };

  const togglePackageActive = async (p: Pkg) => {
    setPackages((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)));
    await supabase.from('packages').update({ active: !p.active }).eq('id', p.id);
  };

  const addPackage = async (game: 'ml' | 'starlight', label: string, price: string, sub?: string) => {
    const value = Number(price);
    if (!label.trim() || !Number.isFinite(value) || value < 0) return;
    const maxOrder = Math.max(0, ...packages.filter((p) => p.game === game && p.tab === (sub ? 'bundles' : game === 'ml' ? 'basic' : 'starlight')).map((p) => p.sort_order));
    await supabase.from('packages').insert({
      game,
      tab: sub ? 'bundles' : game === 'ml' ? 'basic' : 'starlight',
      sub_section: sub ?? null,
      label: label.trim(),
      price: value,
      sort_order: maxOrder + 1,
      active: true,
    });
    await loadAll();
  };

  const deletePackage = async (p: Pkg) => {
    await supabase.from('packages').delete().eq('id', p.id);
    await loadAll();
  };

  const addOtherPackage = async () => {
    const value = Number(newOther.price);
    if (!newOther.name.trim() || !Number.isFinite(value) || value < 0) return;
    await supabase.from('other_packages').insert({
      name: newOther.name.trim(),
      price: value,
      note: newOther.note.trim() || null,
      end_date: newOther.end_date ? new Date(newOther.end_date).toISOString() : null,
      active: true,
      sort_order: Math.max(0, ...otherPackages.map((p) => p.sort_order)) + 1,
    });
    setNewOther({ name: '', price: '', note: '', end_date: '' });
    await loadAll();
  };

  const toggleOtherActive = async (p: OtherPkg) => {
    setOtherPackages((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)));
    await supabase.from('other_packages').update({ active: !p.active }).eq('id', p.id);
  };

  const deleteOtherPackage = async (p: OtherPkg) => {
    await supabase.from('other_packages').delete().eq('id', p.id);
    await loadAll();
  };

  // ---------- render helpers ----------
  const navButton = (key: Section, label: string) => (
    <button
      key={key}
      onClick={() => onNavigate(key)}
      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
        section === key
          ? 'bg-grape text-white shadow-glowSoft'
          : 'border border-grape/40 bg-card text-muted hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="page-enter mx-auto w-full max-w-md px-4 pb-10 sm:max-w-2xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black text-white sm:text-2xl">لوحة المالك</h2>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-xl border border-grape/40 px-3 py-1.5 text-sm font-bold text-muted transition hover:border-grape-light hover:text-white"
        >
          خروج
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {navButton('orders', 'الطلبات')}
        {navButton('packages', 'الباقات')}
        {navButton('accounts', 'الحسابات')}
        {navButton('requests', 'طلبات البيع')}
      </div>

      {section === 'accounts' && (
        <>
          <button
            onClick={() => openNewAccount()}
            className="mb-4 flex items-center gap-1.5 rounded-xl bg-grape px-3.5 py-2 text-sm font-black text-white transition hover:shadow-glow"
          >
            <Plus size={16} />
            إضافة حساب
          </button>

          <div className="space-y-3">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-grape/40 bg-card p-3">
                <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-grape-deep/40">
                  {a.photos[0] ? (
                    <img src={a.photos[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-muted">
                      <ImageOff size={18} />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white" dir="ltr">
                    {a.game_id} / {a.server_id}
                  </p>
                  <p className="text-sm font-black text-grape-light">{formatEGP(a.price)}</p>
                  <p className="text-xs text-muted">
                    {a.page === 'customers' ? 'أكونتات العملاء' : 'أكونتات الستور'}
                    {a.sold && <span className="mr-2 font-bold text-red-400">— تم البيع</span>}
                    {!a.published && <span className="mr-2 font-bold text-amber-400">— غير منشور</span>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button
                    onClick={() => openEditAccount(a)}
                    aria-label="تعديل"
                    className="rounded-xl border border-grape/40 px-2 py-1 text-xs font-bold text-grape-light transition hover:border-grape-light"
                  >
                    تعديل
                  </button>
                  <button
                    onClick={() => toggleSold(a)}
                    aria-label="تم البيع"
                    className={`rounded-xl border px-2 py-1 text-xs font-bold transition ${
                      a.sold ? 'border-red-500/60 text-red-400' : 'border-grape/40 text-muted hover:text-white'
                    }`}
                  >
                    {a.sold ? 'إلغاء البيع' : 'تم البيع'}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(a)}
                    aria-label="حذف"
                    className="rounded-xl border border-red-500/40 px-2 py-1 text-xs font-bold text-red-400 transition hover:bg-red-500/20"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
            {accounts.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">لا توجد حسابات بعد.</p>
            )}
          </div>
        </>
      )}

      {section === 'requests' && (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-2xl border border-grape/40 bg-card p-4">
              {r.photos.length > 0 && (
                <div className="mb-3 flex gap-2 overflow-x-auto">
                  {r.photos.map((p, i) => (
                    <img key={i} src={p} alt="" className="h-16 w-20 shrink-0 rounded-lg object-cover" />
                  ))}
                </div>
              )}
              <p className="text-sm font-bold text-white" dir="ltr">
                {r.game_id} / {r.server_id}
              </p>
              <p className="mt-0.5 text-sm text-muted" dir="ltr">
                {r.contact_number}
              </p>
              <p className="mt-0.5 text-sm font-black text-grape-light">
                السعر المتوقع: {formatEGP(r.expected_price)}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => publishRequest(r)}
                  className="flex-1 rounded-xl bg-grape py-2 text-sm font-black text-white transition hover:shadow-glow"
                >
                  نشر كحساب
                </button>
                <button
                  onClick={() => setDeleteRequest(r)}
                  className="rounded-xl border border-red-500/40 px-3 py-2 text-sm font-bold text-red-400 transition hover:bg-red-500/20"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">لا توجد طلبات بيع بعد.</p>
          )}
        </div>
      )}

      {section === 'packages' && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(ML_TAB_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setMlTab(key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  mlTab === key
                    ? 'bg-grape text-white'
                    : 'border border-grape/40 bg-card text-muted hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mlTab === 'other' ? (
            <>
              <div className="mb-4 rounded-2xl border border-grape/40 bg-card p-4">
                <h3 className="mb-3 text-sm font-black text-white">إضافة حزمة جديدة</h3>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="الاسم"
                    value={newOther.name}
                    onChange={(e) => setNewOther({ ...newOther, name: e.target.value })}
                    className="rounded-xl border border-grape/30 bg-ink px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="number"
                    placeholder="السعر"
                    value={newOther.price}
                    onChange={(e) => setNewOther({ ...newOther, price: e.target.value })}
                    className="rounded-xl border border-grape/30 bg-ink px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="text"
                    placeholder="ملاحظة (اختياري)"
                    value={newOther.note}
                    onChange={(e) => setNewOther({ ...newOther, note: e.target.value })}
                    className="rounded-xl border border-grape/30 bg-ink px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="date"
                    value={newOther.end_date}
                    onChange={(e) => setNewOther({ ...newOther, end_date: e.target.value })}
                    className="rounded-xl border border-grape/30 bg-ink px-3 py-2 text-sm text-white"
                  />
                </div>
                <button
                  onClick={addOtherPackage}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-grape py-2 text-sm font-black text-white transition hover:shadow-glow"
                >
                  <Upload size={14} />
                  إضافة
                </button>
              </div>
              <div className="space-y-2">
                {otherPackages.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 ${
                      p.active ? 'border-grape/40' : 'border-grape/20 opacity-60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white" dir="auto">{p.name}</p>
                      {p.note && <p className="truncate text-xs text-muted" dir="auto">{p.note}</p>}
                      <p className="text-xs text-grape-light">{formatEGP(p.price)}</p>
                    </div>
                    <button
                      onClick={() => toggleOtherActive(p)}
                      className="rounded-lg border border-grape/40 px-2 py-1 text-xs font-bold text-muted transition hover:text-white"
                    >
                      {p.active ? 'إخفاء' : 'إظهار'}
                    </button>
                    <button
                      onClick={() => deleteOtherPackage(p)}
                      aria-label="حذف"
                      className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-500/20"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                {packages
                  .filter((p) => p.tab === mlTab)
                  .map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 ${
                        p.active ? 'border-grape/40' : 'border-grape/20 opacity-60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <input
                          type="text"
                          value={p.label}
                          onChange={(e) => setPackageLabel(p, e.target.value)}
                          className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-sm font-bold text-white transition hover:border-grape/30 focus:border-grape-light focus:bg-ink"
                          dir="auto"
                        />
                        {p.sub_section && (
                          <p className="text-xs text-muted" dir="auto">{p.sub_section}</p>
                        )}
                      </div>
                      <input
                        type="number"
                        value={p.price}
                        onChange={(e) => setPackagePrice(p, e.target.value)}
                        className="w-24 rounded-lg border border-grape/30 bg-ink px-2 py-1.5 text-sm text-white"
                      />
                      <span className="text-xs text-muted">جنيه</span>
                      <button
                        onClick={() => togglePackageActive(p)}
                        className="rounded-lg border border-grape/40 px-2 py-1 text-xs font-bold text-muted transition hover:text-white"
                      >
                        {p.active ? 'إخفاء' : 'إظهار'}
                      </button>
                      <button
                        onClick={() => deletePackage(p)}
                        aria-label="حذف"
                        className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-500/20"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
              </div>
              <AddPackageInline
                game="ml"
                tab={mlTab}
                onAdd={addPackage}
              />
            </>
          )}

          <h3 className="mb-3 mt-8 text-sm font-black text-grape-light">Starlight</h3>
          <div className="space-y-2">
            {packages
              .filter((p) => p.game === 'starlight')
              .map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 ${
                    p.active ? 'border-grape/40' : 'border-grape/20 opacity-60'
                  }`}
                >
                  <input
                    type="text"
                    value={p.label}
                    onChange={(e) => setPackageLabel(p, e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-sm font-bold text-white transition hover:border-grape/30 focus:border-grape-light focus:bg-ink"
                    dir="auto"
                  />
                  <input
                    type="number"
                    value={p.price}
                    onChange={(e) => setPackagePrice(p, e.target.value)}
                    className="w-24 rounded-lg border border-grape/30 bg-ink px-2 py-1.5 text-sm text-white"
                  />
                  <span className="text-xs text-muted">جنيه</span>
                  <button
                    onClick={() => togglePackageActive(p)}
                    className="rounded-lg border border-grape/40 px-2 py-1 text-xs font-bold text-muted transition hover:text-white"
                  >
                    {p.active ? 'إخفاء' : 'إظهار'}
                  </button>
                  <button
                    onClick={() => deletePackage(p)}
                    aria-label="حذف"
                    className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-500/20"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
          </div>
          <AddPackageInline game="starlight" tab="starlight" onAdd={addPackage} />
        </>
      )}

      {section === 'orders' && <AdminOrders />}

      {/* ---------- modals ---------- */}
      {draft && (
        <ModalShell onClose={() => !saving && setDraft(null)}>
          <h4 className="mb-4 text-center text-lg font-black text-white">
            {draft.id ? 'تعديل حساب' : 'إضافة حساب'}
          </h4>
          <div className="space-y-3.5">
            <div>
              <span className="mb-1 block text-xs font-semibold text-muted">الصور (حتى 8)</span>
              {(draft.photos.length > 0 || newFiles.length > 0) && (
                <div className="mb-2 grid grid-cols-4 gap-2">
                  {draft.photos.map((url) => (
                    <div key={url} className="relative aspect-square overflow-hidden rounded-lg">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => setDraft({ ...draft, photos: draft.photos.filter((p) => p !== url) })}
                        aria-label="حذف الصورة"
                        className="absolute left-1 top-1 rounded-full bg-black/70 p-0.5 text-white transition hover:bg-red-500"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {newFiles.map((f, i) => (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-lg">
                      <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => setNewFiles((prev) => prev.filter((_, j) => j !== i))}
                        aria-label="حذف الصورة"
                        className="absolute left-1 top-1 rounded-full bg-black/70 p-0.5 text-white transition hover:bg-red-500"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  setNewFiles((prev) => [...prev, ...files].slice(0, 8));
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="w-full rounded-xl border border-dashed border-grape/50 bg-ink py-2.5 text-xs font-semibold text-grape-light transition hover:border-grape-light"
              >
                اختيار الصور
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted">Game ID</span>
                <input
                  type="text"
                  dir="ltr"
                  value={draft.game_id}
                  onChange={(e) => setDraft({ ...draft, game_id: e.target.value })}
                  className="w-full rounded-xl border border-grape/30 bg-ink px-3.5 py-2.5 text-left text-sm text-white focus:border-grape-light"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted">Server ID</span>
                <input
                  type="text"
                  dir="ltr"
                  value={draft.server_id}
                  onChange={(e) => setDraft({ ...draft, server_id: e.target.value })}
                  className="w-full rounded-xl border border-grape/30 bg-ink px-3.5 py-2.5 text-left text-sm text-white focus:border-grape-light"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted">رقم التواصل</span>
              <input
                type="tel"
                dir="ltr"
                value={draft.contact_number}
                onChange={(e) => setDraft({ ...draft, contact_number: e.target.value })}
                placeholder="01xxxxxxxxx"
                className="w-full rounded-xl border border-grape/30 bg-ink px-3.5 py-2.5 text-left text-sm text-white focus:border-grape-light"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted">السعر (جنيه)</span>
                <input
                  type="number"
                  min="0"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  className="w-full rounded-xl border border-grape/30 bg-ink px-3.5 py-2.5 text-sm text-white focus:border-grape-light"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted">الصفحة</span>
                <select
                  value={draft.page}
                  onChange={(e) => setDraft({ ...draft, page: e.target.value as 'customers' | 'store' })}
                  className="w-full rounded-xl border border-grape/30 bg-ink px-3 py-2.5 text-sm text-white focus:border-grape-light"
                >
                  <option value="customers">أكونتات العملاء</option>
                  <option value="store">أكونتات الستور</option>
                </select>
              </label>
            </div>

            <div className="flex gap-5">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.sold}
                  onChange={(e) => setDraft({ ...draft, sold: e.target.checked })}
                  className="h-4 w-4 accent-[#6D3FE0]"
                />
                <span className="text-sm font-semibold text-body">تم البيع</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
                  className="h-4 w-4 accent-[#6D3FE0]"
                />
                <span className="text-sm font-semibold text-body">منشور</span>
              </label>
            </div>

            {formError && <p className="text-sm font-semibold text-red-400">{formError}</p>}

            <button
              onClick={saveAccount}
              disabled={saving}
              className="w-full rounded-xl bg-grape py-3 font-black text-white transition hover:shadow-glow disabled:opacity-50"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <ModalShell onClose={() => setDeleteTarget(null)}>
          <h4 className="text-center text-lg font-black text-white">حذف الحساب</h4>
          <p className="mt-2 text-center text-sm text-muted">هل أنت متأكد من حذف هذا الحساب؟ لا يمكن التراجع.</p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 rounded-xl border border-white/30 py-2.5 font-bold text-white transition hover:bg-white/10"
            >
              إلغاء
            </button>
            <button
              onClick={confirmDeleteAccount}
              className="flex-1 rounded-xl bg-red-500 py-2.5 font-black text-white transition hover:bg-red-600"
            >
              حذف
            </button>
          </div>
        </ModalShell>
      )}

      {deleteRequest && (
        <ModalShell onClose={() => setDeleteRequest(null)}>
          <h4 className="text-center text-lg font-black text-white">حذف طلب البيع</h4>
          <p className="mt-2 text-center text-sm text-muted">هل أنت متأكد من حذف هذا الطلب؟</p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setDeleteRequest(null)}
              className="flex-1 rounded-xl border border-white/30 py-2.5 font-bold text-white transition hover:bg-white/10"
            >
              إلغاء
            </button>
            <button
              onClick={confirmDeleteRequest}
              className="flex-1 rounded-xl bg-red-500 py-2.5 font-black text-white transition hover:bg-red-600"
            >
              حذف
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function AddPackageInline({
  game,
  tab,
  onAdd,
}: {
  game: 'ml' | 'starlight';
  tab: string;
  onAdd: (game: 'ml' | 'starlight', label: string, price: string, sub?: string) => Promise<void>;
}) {
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const [sub, setSub] = useState('');
  const isBundles = tab === 'bundles';

  return (
    <div className="mt-3 rounded-2xl border border-dashed border-grape/50 bg-card p-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="الاسم (مثال: 50 + 5)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-xl border border-grape/30 bg-ink px-3 py-2 text-sm text-white"
        />
        <input
          type="number"
          placeholder="السعر"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="rounded-xl border border-grape/30 bg-ink px-3 py-2 text-sm text-white"
        />
        {isBundles && (
          <input
            type="text"
            placeholder="القسم الفرعي"
            value={sub}
            onChange={(e) => setSub(e.target.value)}
            className="col-span-2 rounded-xl border border-grape/30 bg-ink px-3 py-2 text-sm text-white"
          />
        )}
      </div>
      <button
        onClick={() => {
          void onAdd(game, label, price, isBundles ? sub || undefined : undefined);
          setLabel('');
          setPrice('');
        }}
        className="mt-2 w-full rounded-xl bg-grape py-2 text-sm font-black text-white transition hover:shadow-glow"
      >
        إضافة باقة
      </button>
    </div>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="pop-in max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-grape/40 bg-card p-5 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
