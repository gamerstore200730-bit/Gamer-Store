import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { SUPPORT_LINK, ORDER_ID_KEY, minutesSince, formatEGP } from '../data/store';
import { insertOrder, fetchOrderById } from '../lib/api';
import type { StoreOrder } from '../lib/api';
import type { OrderStatus } from '../data/store';

interface Props {
  game: 'ml' | 'starlight';
  packageName: string;
  packagePrice: number;
  onOrderCreated?: () => void;
}

function StatusNotice({ order }: { order: StoreOrder }) {
  const minutes = minutesSince(order.created_at);
  const isLate = order.status === 'pending' && minutes >= 60;
  const status: OrderStatus = order.status === 'completed' ? 'completed' : isLate ? 'delayed' : 'pending';

  if (status === 'pending') {
    return (
      <p className="text-sm font-semibold text-body">
        تم تأكيد طلبك. سيتم الشحن خلال 10 دقائق إلى 60 دقيقة.
      </p>
    );
  }
  if (status === 'completed') {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-bold text-emerald-400">تم الشحن بنجاح</p>
        <p className="text-xs text-muted">
          حصلت مشكلة؟{' '}
          <a
            href={SUPPORT_LINK}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-grape-light underline underline-offset-2 hover:text-white"
          >
            تواصل مع الدعم
          </a>
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-bold text-red-400">تأخر الشحن عن 60 دقيقة، تواصل مع الدعم</p>
      <p className="text-xs text-muted">
        <a
          href={SUPPORT_LINK}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-grape-light underline underline-offset-2 hover:text-white"
        >
          رقم الدعم
        </a>
      </p>
    </div>
  );
}

export default function TopUpForm({ game, packageName, packagePrice, onOrderCreated }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const [serverId, setServerId] = useState('');
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const loadedForPackage = useRef<string | null>(null);

  // Load saved order when the form appears for this package (or any return visit)
  useEffect(() => {
    if (loadedForPackage.current === packageName) return;
    loadedForPackage.current = packageName;

    const savedId = localStorage.getItem(ORDER_ID_KEY);
    if (!savedId) return;
    fetchOrderById(savedId)
      .then((o) => {
        if (o) {
          setOrder(o);
          setPlayerId(o.player_id);
          setServerId(o.server_id);
        }
      })
      .catch(() => undefined);
  }, [packageName]);

  // Poll order status every 10 seconds
  useEffect(() => {
    if (!order) return;
    const id = order.id;
    const timer = setInterval(() => {
      fetchOrderById(id)
        .then((o) => {
          if (o) setOrder(o);
        })
        .catch(() => undefined);
    }, 10000);
    return () => clearInterval(timer);
  }, [order]);

  const confirmed = order !== null;

  const confirm = async () => {
    setShowModal(false);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await insertOrder({
        game,
        package_label: packageName,
        price: packagePrice,
        player_id: playerId.trim(),
        server_id: serverId.trim(),
      });
      if (created) {
        setOrder(created);
        localStorage.setItem(ORDER_ID_KEY, created.id);
        onOrderCreated?.();
      } else {
        setSubmitError('تعذر إنشاء الطلب، حاول مرة أخرى.');
      }
    } catch {
      setSubmitError('تعذر إنشاء الطلب، حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-grape/30 bg-ink px-4 py-3 text-white transition focus:border-grape-light focus:shadow-glowSoft read-only:opacity-70';

  return (
    <section className="page-enter scroll-mt-6">
      <h3 className="mb-4 text-lg font-black text-white">إتمام الطلب</h3>
      <div className="rounded-2xl border border-grape/40 bg-card p-5 shadow-glowSoft">
        <div className="mb-4 flex items-center justify-between rounded-xl border border-grape/30 bg-grape-deep/60 px-4 py-3">
          <div>
            <span className="block text-xs text-muted">الباقة المختارة</span>
            <p className="font-black text-grape-light" dir="auto">{packageName}</p>
          </div>
          <span className="text-sm font-bold text-body">{formatEGP(packagePrice)}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-body">Player ID</span>
            <input
              type="text"
              inputMode="numeric"
              value={playerId}
              onChange={(e) => !confirmed && setPlayerId(e.target.value.replace(/\D/g, ''))}
              readOnly={confirmed}
              placeholder="مثال: 123456789"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-body">Server ID</span>
            <input
              type="text"
              inputMode="numeric"
              value={serverId}
              onChange={(e) => !confirmed && setServerId(e.target.value.replace(/\D/g, ''))}
              readOnly={confirmed}
              placeholder="مثال: 2048"
              className={inputClass}
            />
          </label>
        </div>

        {!confirmed && (
          <button
            onClick={() => setShowModal(true)}
            disabled={!playerId.trim() || !serverId.trim() || submitting}
            className="mt-5 w-full rounded-xl bg-grape py-3 font-black text-white transition hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'جارٍ الإرسال...' : 'تأكيد'}
          </button>
        )}

        {submitError && (
          <p className="mt-3 text-center text-sm font-semibold text-red-400">{submitError}</p>
        )}

        {confirmed && order && (
          <div className="mt-5 rounded-xl border border-grape/30 bg-grape-deep/50 px-4 py-3">
            <StatusNotice order={order} />
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <h4 className="text-center text-lg font-black leading-relaxed text-red-500 sm:text-xl">
          بعد التأكيد مش هتقدر تعدّل الـ ID ولا السيرفر
        </h4>
        <p className="mt-3 text-center text-sm leading-relaxed text-muted">
          لو الـ ID أو السيرفر غلط، هتتم عملية الشحن على الحساب المكتوب ولا يمكن التعديل أو
          الاسترجاع. تأكد من البيانات قبل المتابعة.
        </p>
        <div className="mt-4 rounded-xl border border-grape/30 bg-ink px-4 py-3 text-sm">
          <div className="flex justify-between border-b border-grape/20 py-1.5">
            <span className="text-muted">الباقة</span>
            <span className="font-semibold text-body" dir="auto">{packageName}</span>
          </div>
          <div className="flex justify-between border-b border-grape/20 py-1.5">
            <span className="text-muted">Player ID</span>
            <span className="font-semibold text-body" dir="ltr">
              {playerId}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-muted">Server ID</span>
            <span className="font-semibold text-body" dir="ltr">
              {serverId}
            </span>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button
            onClick={confirm}
            className="flex-1 rounded-xl bg-grape py-3 font-black text-white transition hover:shadow-glow"
          >
            تأكيد
          </button>
          <button
            onClick={() => setShowModal(false)}
            className="flex-1 rounded-xl border border-white/30 bg-transparent py-3 font-bold text-white transition hover:bg-white/10"
          >
            تعديل
          </button>
        </div>
      </Modal>
    </section>
  );
}
