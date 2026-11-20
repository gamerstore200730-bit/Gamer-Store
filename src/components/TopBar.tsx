import { ArrowRight } from 'lucide-react';
import type { Page } from '../data/store';

interface Props {
  onBack: () => void;
  title: string;
  go: (page: Page) => void;
}

export default function TopBar({ onBack, title, go }: Props) {
  return (
    <header className="relative z-20 flex items-center justify-between gap-3 px-4 py-3">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 rounded-full border border-grape/40 bg-card/70 px-3 py-1.5 text-sm font-semibold text-body transition hover:border-grape-light hover:text-white hover:shadow-glowSoft"
      >
        <ArrowRight size={16} />
        <span>رجوع</span>
      </button>
      <button
        onClick={() => go('home')}
        className="bg-gradient-to-l from-[#8f8aa0] via-[#c9b7f5] to-grape-light bg-clip-text text-xl font-black tracking-wide text-transparent transition hover:opacity-90 sm:text-2xl"
      >
        Gamer Store
      </button>
      <span className="w-[68px]" />
    </header>
  );
}
