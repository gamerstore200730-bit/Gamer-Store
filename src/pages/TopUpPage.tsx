import { useEffect, useMemo, useRef, useState } from 'react';
import { Gem, Star } from 'lucide-react';
import { fetchPackages, fetchActiveOtherPackages } from '../lib/api';
import type { Pkg, OtherPkg } from '../lib/api';
import TopUpForm from '../components/TopUpForm';
import { formatEGP } from '../data/store';

interface Props {
  variant: 'ml' | 'starlight';
}

const ML_TABS = [
  { key: 'double', label: 'باقات مضاعفة' },
  { key: 'basic', label: 'باقات أساسية' },
  { key: 'bundles', label: 'حزم واشتراكات' },
  { key: 'other', label: 'حزم أخرى' },
] as const;

type TabKey = (typeof ML_TABS)[number]['key'];

export default function TopUpPage({ variant }: Props) {
  const isML = variant === 'ml';
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [otherPackages, setOtherPackages] = useState<OtherPkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<TabKey>('basic');
  const [selected, setSelected] = useState<{ label: string; price: number } | null>(null);
  const [orderCount, setOrderCount] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      fetchPackages(variant),
      isML ? fetchActiveOtherPackages() : Promise.resolve([] as OtherPkg[]),
    ])
      .then(([pkgs, others]) => {
        setPackages(pkgs);
        setOtherPackages(others);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [variant, isML]);

  const bundlesSubSections = useMemo(() => {
    const bundlePkgs = packages.filter((p) => p.tab === 'bundles');
    const map = new Map<string, Pkg[]>();
    for (const p of bundlePkgs) {
      const key = p.sub_section ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries());
  }, [packages]);

  const pick = (label: string, price: number) => {
    setSelected({ label, price });
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const tabPkgs = packages.filter((p) => p.tab === tab);

  const isGems = (label: string) => /^\d+(\s*\+\s*\d+)?$/.test(label.trim());

  const PackageCard = ({ label, price }: { label: string; price: number }) => {
    const active = selected?.label === label;
    return (
      <button
        onClick={() => pick(label, price)}
        className={`flex h-full flex-col items-center justify-center rounded-2xl border p-4 text-center transition duration-300 hover:-translate-y-1 hover:border-grape-light hover:shadow-glow ${
          active ? 'border-grape-light bg-carddeep shadow-glow' : 'border-grape/40 bg-card'
        }`}
      >
        <p className="font-black text-white" dir="auto">
          {isGems(label) ? `${label} جوهرة` : label}
        </p>
        <p className="mt-1 text-sm font-semibold text-grape-light">{formatEGP(price)}</p>
      </button>
    );
  };

  const OtherCard = ({ name, price, note }: { name: string; price: number; note?: string | null }) => {
    const active = selected?.label === name;
    return (
      <button
        onClick={() => pick(name, price)}
        className={`flex h-full flex-col items-center justify-center rounded-2xl border p-4 text-center transition duration-300 hover:-translate-y-1 hover:border-grape-light hover:shadow-glow ${
          active ? 'border-grape-light bg-carddeep shadow-glow' : 'border-grape/40 bg-card'
        }`}
      >
        <p className="font-black text-white" dir="auto">{name}</p>
        {note && <p className="mt-0.5 text-xs text-muted" dir="auto">{note}</p>}
        <p className="mt-1 text-sm font-semibold text-grape-light">{formatEGP(price)}</p>
      </button>
    );
  };

  const StarlightCard = ({ label, price }: { label: string; price: number }) => {
    const active = selected?.label === label;
    return (
      <button
        onClick={() => pick(label, price)}
        className={`flex h-full flex-col items-center justify-center rounded-2xl border p-4 text-center transition duration-300 hover:-translate-y-1 hover:border-grape-light hover:shadow-glow ${
          active ? 'border-grape-light bg-carddeep shadow-glow' : 'border-grape/40 bg-card'
        }`}
      >
        <p className="font-black text-white" dir="auto">{label}</p>
        <p className="mt-1 text-sm font-semibold text-grape-light">{formatEGP(price)}</p>
      </button>
    );
  };

  return (
    <div className="page-enter mx-auto w-full max-w-md px-4 pb-10 sm:max-w-2xl">
      <div className="mb-5 flex items-center justify-center gap-2">
        {isML ? (
          <Gem size={22} className="text-grape-light" />
        ) : (
          <Star size={22} className="text-grape-light" />
        )}
        <h2 className="text-xl font-black text-white sm:text-2xl">
          شحن {isML ? 'Mobile Legends' : 'Starlight'}
        </h2>
      </div>

      {isML && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ML_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                tab === t.key
                  ? 'bg-grape text-white shadow-glowSoft'
                  : 'border border-grape/40 bg-card text-muted hover:border-grape-light hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="py-8 text-center text-sm text-muted">جارٍ التحميل...</p>}
      {error && !loading && (
        <p className="py-8 text-center text-sm text-red-400">حدث خطأ في تحميل الباقات.</p>
      )}

      {!loading && !error && isML && (
        <>
          {tab === 'other' ? (
            otherPackages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">لا توجد حزم متاحة حاليًا</p>
            ) : (
              <div className="mx-auto grid w-full max-w-[520px] grid-cols-2 gap-3">
                {otherPackages.map((p) => (
                  <OtherCard key={p.id} name={p.name} price={p.price} note={p.note} />
                ))}
              </div>
            )
          ) : tab === 'bundles' ? (
            <div className="space-y-6">
              {bundlesSubSections.map(([sub, pkgs]) => (
                <section key={sub}>
                  <h3 className="mb-3 text-center text-sm font-black text-grape-light" dir="auto">
                    {sub}
                  </h3>
                  <div className="mx-auto grid w-full max-w-[520px] grid-cols-2 gap-3">
                    {pkgs.map((p) => (
                      <PackageCard key={p.id} label={p.label} price={p.price} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="mx-auto grid w-full max-w-[520px] grid-cols-2 gap-3">
              {tabPkgs.map((p) => (
                <PackageCard key={p.id} label={p.label} price={p.price} />
              ))}
            </div>
          )}
        </>
      )}

      {!loading && !error && !isML && (
        <div className="mx-auto grid w-full max-w-[520px] grid-cols-2 gap-3">
          {packages.map((p) => (
            <StarlightCard key={p.id} label={p.label} price={p.price} />
          ))}
        </div>
      )}

      <div ref={formRef} className="scroll-mt-6">
        {selected ? (
          <div className="mt-8">
            <TopUpForm
              key={`${variant}-${selected.label}-${orderCount}`}
              game={variant}
              packageName={selected.label}
              packagePrice={selected.price}
              onOrderCreated={() => setOrderCount((c) => c + 1)}
            />
          </div>
        ) : (
          <p className="mt-8 text-center text-sm text-muted">اختر باقة أولًا لإتمام الطلب.</p>
        )}
      </div>
    </div>
  );
}
