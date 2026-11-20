import { useState } from 'react';
import { Copy, Check, MessageCircle } from 'lucide-react';
import type { GameAccount } from '../lib/api';
import { formatEGP } from '../data/store';
import Lightbox from './Lightbox';

export default function AccountCard({ account }: { account: GameAccount }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [copied, setCopied] = useState<'game' | 'server' | null>(null);

  const copy = async (value: string, which: 'game' | 'server') => {
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
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  const main = account.photos[0];
  const thumbs = account.photos.slice(1, 5);

  return (
    <div
      className={`flex h-full flex-col rounded-2xl border border-grape/40 bg-card transition duration-300 ${
        account.sold
          ? 'opacity-50'
          : 'hover:-translate-y-1 hover:border-grape-light hover:shadow-glow'
      }`}
    >
      <div className="relative">
        {account.sold && (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-red-500/90 px-2.5 py-0.5 text-[11px] font-black text-white">
            تم البيع
          </span>
        )}
        {main ? (
          <button
            onClick={() => !account.sold && setLightbox(0)}
            className="block aspect-[4/3] w-full overflow-hidden rounded-t-2xl"
          >
            <img src={main} alt="صورة الحساب" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-t-2xl bg-grape-deep/40 text-sm text-muted">
            لا توجد صور
          </div>
        )}
        {thumbs.length > 0 && (
          <div className="absolute bottom-2 right-2 left-2 flex gap-1.5">
            {thumbs.map((p, i) => (
              <button
                key={i}
                onClick={() => !account.sold && setLightbox(i + 1)}
                className="h-9 w-11 overflow-hidden rounded-md border border-white/20 transition hover:border-grape-light"
              >
                <img src={p} alt={`صورة ${i + 2}`} loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-center justify-between rounded-xl border border-grape/30 bg-ink px-3 py-2">
          <div className="min-w-0">
            <span className="block text-[10px] text-muted">Game ID</span>
            <span className="block truncate text-sm font-bold text-white" dir="ltr">
              {account.game_id}
            </span>
          </div>
          <button
            onClick={() => copy(account.game_id, 'game')}
            aria-label="نسخ Game ID"
            className="shrink-0 rounded-lg p-1.5 text-grape-light transition hover:bg-grape/20"
          >
            {copied === 'game' ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-grape/30 bg-ink px-3 py-2">
          <div className="min-w-0">
            <span className="block text-[10px] text-muted">Server ID</span>
            <span className="block truncate text-sm font-bold text-white" dir="ltr">
              {account.server_id}
            </span>
          </div>
          <button
            onClick={() => copy(account.server_id, 'server')}
            aria-label="نسخ Server ID"
            className="shrink-0 rounded-lg p-1.5 text-grape-light transition hover:bg-grape/20"
          >
            {copied === 'server' ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>

        <div className="mt-auto space-y-2.5">
          <p className="text-lg font-black text-grape-light">{formatEGP(account.price)}</p>
          <a
            href={`https://wa.me/2${account.contact_number.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => account.sold && e.preventDefault()}
            aria-disabled={account.sold}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black transition ${
              account.sold
                ? 'cursor-not-allowed bg-white/10 text-muted'
                : 'bg-grape text-white hover:shadow-glow'
            }`}
          >
            <MessageCircle size={16} />
            تواصل للشراء
          </a>
        </div>
      </div>

      {lightbox !== null && (
        <Lightbox photos={account.photos} index={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
