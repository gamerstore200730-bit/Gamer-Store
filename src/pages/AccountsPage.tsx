import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { fetchAccounts } from '../lib/api';
import type { GameAccount } from '../lib/api';
import { supabase } from '../lib/supabase';
import AccountCard from '../components/AccountCard';

interface Props {
  variant: 'customers' | 'store';
}

interface PendingPhoto {
  file: File;
  url: string;
}

export default function AccountsPage({ variant }: Props) {
  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [sellGameId, setSellGameId] = useState('');
  const [sellServerId, setSellServerId] = useState('');
  const [sellContact, setSellContact] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellSent, setSellSent] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);
  const [sellBusy, setSellBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAccounts(variant)
      .then(setAccounts)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [variant]);

  const title = variant === 'customers' ? 'أكونتات العملاء' : 'أكونتات الستور';

  const submitSell = async (e: React.FormEvent) => {
    e.preventDefault();
    setSellBusy(true);
    setSellError(null);
    try {
      const uploaded: string[] = [];
      for (const p of photos) {
        const ext = p.file.name.split('.').pop() || 'jpg';
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('account-photos')
          .upload(path, p.file, { contentType: p.file.type });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('account-photos').getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      const { error: insErr } = await supabase.from('account_requests').insert({
        photos: uploaded,
        game_id: sellGameId.trim(),
        server_id: sellServerId.trim(),
        contact_number: sellContact.trim(),
        expected_price: Number(sellPrice),
      });
      if (insErr) throw insErr;
      setSellSent(true);
    } catch {
      setSellError('حدث خطأ أثناء الإرسال. حاول مرة أخرى.');
    } finally {
      setSellBusy(false);
    }
  };

  return (
    <div className="page-enter mx-auto w-full max-w-md px-4 pb-10 sm:max-w-2xl">
      <h2 className="mb-1 text-center text-xl font-black text-white sm:text-2xl">{title}</h2>

      <div className="mb-5 flex items-center justify-center gap-1.5 text-xs text-muted">
        <ShieldCheck size={14} className="text-grape-light" />
        <span>كل الحسابات مضمونة ومفحوصة بالكامل قبل العرض، مع ضمان كامل عند الاستلام.</span>
      </div>

      {loading && <p className="py-8 text-center text-sm text-muted">جارٍ التحميل...</p>}
      {error && !loading && (
        <p className="py-8 text-center text-sm text-red-400">حدث خطأ في تحميل الحسابات.</p>
      )}

      {!loading && !error && accounts.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">لا توجد حسابات معروضة حاليًا.</p>
      )}

      {!loading && !error && accounts.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {accounts.map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}
        </div>
      )}

      {variant === 'customers' && (
        <section className="mt-10">
          <h3 className="mb-3 text-lg font-black text-white">بيع حسابك</h3>
          <div className="rounded-2xl border border-grape/40 bg-card p-5">
            {sellSent ? (
              <p className="rounded-xl border border-grape/30 bg-grape-deep/50 px-4 py-3 text-center text-sm font-semibold text-body">
                تم استلام طلبك وسيتم مراجعته والتواصل معك
              </p>
            ) : (
              <form onSubmit={submitSell} className="space-y-4">
                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-body">الصور</span>
                  {photos.length > 0 && (
                    <div className="mb-2 grid grid-cols-4 gap-2">
                      {photos.map((p, i) => (
                        <div key={i} className="relative aspect-square overflow-hidden rounded-lg">
                          <img src={p.url} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                            aria-label="حذف الصورة"
                            className="absolute left-1 top-1 rounded-full bg-black/70 p-0.5 text-white transition hover:bg-red-500"
                          >
                            ✕
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
                      setPhotos((prev) =>
                        [...prev, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 8)
                      );
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="w-full rounded-xl border border-dashed border-grape/50 bg-ink py-2.5 text-xs font-semibold text-grape-light transition hover:border-grape-light"
                  >
                    اختيار الصور (حتى 8)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-body">Game ID</span>
                    <input
                      type="text"
                      dir="ltr"
                      value={sellGameId}
                      onChange={(e) => setSellGameId(e.target.value)}
                      required
                      className="w-full rounded-xl border border-grape/30 bg-ink px-4 py-3 text-left text-white focus:border-grape-light focus:shadow-glowSoft"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-body">Server ID</span>
                    <input
                      type="text"
                      dir="ltr"
                      value={sellServerId}
                      onChange={(e) => setSellServerId(e.target.value)}
                      required
                      className="w-full rounded-xl border border-grape/30 bg-ink px-4 py-3 text-left text-white focus:border-grape-light focus:shadow-glowSoft"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-body">رقم التواصل</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    value={sellContact}
                    onChange={(e) => setSellContact(e.target.value)}
                    required
                    placeholder="01xxxxxxxxx"
                    className="w-full rounded-xl border border-grape/30 bg-ink px-4 py-3 text-left text-white focus:border-grape-light focus:shadow-glowSoft"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-body">السعر المتوقع (جنيه)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    required
                    placeholder="مثال: 5,000"
                    className="w-full rounded-xl border border-grape/30 bg-ink px-4 py-3 text-white focus:border-grape-light focus:shadow-glowSoft"
                  />
                </label>

                {sellError && <p className="text-sm font-semibold text-red-400">{sellError}</p>}

                <button
                  type="submit"
                  disabled={sellBusy}
                  className="w-full rounded-xl bg-grape py-3 font-black text-white transition hover:shadow-glow disabled:opacity-50"
                >
                  {sellBusy ? 'جارٍ الإرسال...' : 'إرسال'}
                </button>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
