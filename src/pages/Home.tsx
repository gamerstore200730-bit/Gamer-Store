import { Gem, Store, Smartphone, Star } from 'lucide-react';
import type { Page } from '../data/store';

interface Props {
  go: (page: Page) => void;
}

const TILES: { page: Page; label: string; icon: React.ReactNode; highlight?: boolean }[] = [
  { page: 'accounts-customers', label: 'عرض أكونتات العملاء', icon: <Store size={34} strokeWidth={1.5} /> },
  { page: 'accounts-store', label: 'عرض أكونتات الستور', icon: <Gem size={34} strokeWidth={1.5} /> },
  { page: 'topup-ml', label: 'شحن Mobile Legends', icon: <Smartphone size={34} strokeWidth={1.5} />, highlight: true },
  { page: 'topup-starlight', label: 'شحن Starlight', icon: <Star size={34} strokeWidth={1.5} />, highlight: true },
];

export default function Home({ go }: Props) {
  return (
    <div className="relative z-10 flex min-h-full flex-col overflow-hidden" style={{ height: '100dvh' }}>
      <div className="shrink-0 py-3 text-center">
        <span className="bg-gradient-to-l from-[#8f8aa0] via-[#c9b7f5] to-grape-light bg-clip-text text-2xl font-black tracking-wide text-transparent sm:text-3xl">
          Gamer Store
        </span>
      </div>

      <div
        className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-[3.5vh] px-5 pb-[3vh] sm:max-w-lg"
        style={{ fontSize: 'clamp(13px, 1.6vh, 18px)' }}
      >
        <h1 className="text-center font-black leading-[1.45] text-body" style={{ fontSize: '1.5em' }}>
          وجهتك الآمنة لشحن وبيع وشراء كل ما يخص{' '}
          <span className="text-grape-light" style={{ textShadow: '0 0 18px rgba(155,107,255,0.7)' }}>
            Mobile Legends
          </span>
        </h1>

        <p className="text-center text-[0.85em] leading-relaxed text-muted">
          وجهتك الموثوقة لشحن الجواهر بأمان وسرعة فائقة، وبيع وشراء الحسابات المضمونة، مع الاستمتاع
          بأقوى العروض والخصومات الحصرية للاعبين.
        </p>

        <div className="grid w-full grid-cols-2 gap-[1.8vh]">
          {TILES.map((tile) => (
            <button
              key={tile.page}
              onClick={() => go(tile.page)}
              className={`group flex aspect-square flex-col items-center justify-center gap-[1.6vh] rounded-2xl border p-3 text-center transition duration-300 hover:-translate-y-1 hover:shadow-glow ${
                tile.highlight
                  ? 'border-grape/70 bg-carddeep/80'
                  : 'border-grape/40 bg-card/80'
              } hover:border-grape-light`}
            >
              <span className="text-grape-light transition group-hover:drop-shadow-[0_0_10px_rgba(155,107,255,0.8)]">
                {tile.icon}
              </span>
              <span className="text-[0.9em] font-bold leading-snug text-body group-hover:text-white">
                {tile.label}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => go('admin')}
          className="text-[0.65em] text-muted/40 transition hover:text-grape-light"
        >
          Admin
        </button>
      </div>
    </div>
  );
}
