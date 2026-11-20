import { useEffect, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { StoreOrder } from '../lib/api';
import { fetchOrders } from '../lib/api';
import { supabase } from '../lib/supabase';
import { formatEGP, minutesSince, timeSince } from '../data/store';
import { playNotificationSound } from '../lib/sound';

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement('textarea');
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <span className="inline-flex items-center gap-1" dir="ltr">
      <span className="font-bold text-white">{value}</span>
      <button
        onClick={copy}
        aria-label="نسخ"
        className="rounded-md p-1 text-grape-light transition hover:bg-grape/20"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </span>
  );
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [tab, setTab] = useState<'pending' | 'completed'>('pending');
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    fetchOrders()
      .then((rows) => {
        knownIds.current = new Set(rows.map((o) => o.id));
        setOrders(rows);
      })
      .finally(() => setLoading(false));

    const channel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders().then((rows) => {
            const fresh = rows.filter((o) => !knownIds.current?.has(o.id));
            if (fresh.length > 0) {
              playNotificationSound();
              setNewIds((prev) => new Set([...prev, ...fresh.map((o) => o.id)]));
              setTimeout(() => {
                setNewIds((prev) => {
                  const next = new Set(prev);
                  for (const o of fresh) next.delete(o.id);
                  return next;
                });
              }, 8000);
            }
            knownIds.current = new Set(rows.map((o) => o.id));
            setOrders(rows);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const complete = async (o: StoreOrder) => {
    await supabase
      .from('orders')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', o.id);
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: 'completed', completed_at: new Date().toISOString() } : x)));
  };

  const shown = orders.filter((o) => o.status === tab);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('pending')}
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${
            tab === 'pending'
              ? 'bg-grape text-white shadow-glowSoft'
              : 'border border-grape/40 bg-card text-muted hover:text-white'
          }`}
        >
          قيد التنفيذ
        </button>
        <button
          onClick={() => setTab('completed')}
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${
            tab === 'completed'
              ? 'bg-grape text-white shadow-glowSoft'
              : 'border border-grape/40 bg-card text-muted hover:text-white'
          }`}
        >
          تم الشحن
        </button>
      </div>

      {loading && <p className="py-8 text-center text-sm text-muted">جارٍ التحميل...</p>}
      {!loading && shown.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">لا توجد طلبات هنا.</p>
      )}

      <div className="space-y-3">
        {shown.map((o) => {
          const late = o.status === 'pending' && minutesSince(o.created_at) >= 60;
          const isNew = newIds.has(o.id);
          return (
            <div
              key={o.id}
              className={`rounded-2xl border bg-card p-4 transition ${
                isNew
                  ? 'border-grape-light shadow-glow'
                  : late
                    ? 'border-red-500/60'
                    : 'border-grape/40'
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-black text-grape-light">
                  {o.game === 'ml' ? 'Mobile Legends' : 'Starlight'}
                </span>
                <span className="text-sm font-bold text-body">
                  {formatEGP(o.price)} — {timeSince(o.created_at)}
                </span>
              </div>
              <p className="mb-2 text-sm text-muted" dir="auto">
                {o.package_label}
              </p>
              <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                <span className="text-muted">
                  Player ID: <CopyField value={o.player_id} />
                </span>
                <span className="text-muted">
                  Server ID: <CopyField value={o.server_id} />
                </span>
              </div>
              {o.status === 'pending' ? (
                <button
                  onClick={() => complete(o)}
                  className="w-full rounded-xl bg-grape py-2.5 text-sm font-black text-white transition hover:shadow-glow"
                >
                  تم الشحن
                </button>
              ) : (
                <p className="rounded-xl bg-emerald-500/10 py-2 text-center text-sm font-bold text-emerald-400">
                  تم الشحن بنجاح
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
