import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
  photos: string[];
  index: number;
  onClose: () => void;
}

export default function Lightbox({ photos, index, onClose }: Props) {
  const [current, setCurrent] = useState(index);

  useEffect(() => setCurrent(index), [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrent((c) => (c + 1) % photos.length);
      if (e.key === 'ArrowLeft') setCurrent((c) => (c - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [photos.length, onClose]);

  let touchStartX = 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        aria-label="إغلاق"
        className="absolute left-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
      >
        <X size={22} />
      </button>

      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCurrent((c) => (c - 1 + photos.length) % photos.length);
            }}
            aria-label="السابق"
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <ChevronRight size={26} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCurrent((c) => (c + 1) % photos.length);
            }}
            aria-label="التالي"
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <ChevronLeft size={26} />
          </button>
        </>
      )}

      <img
        src={photos[current]}
        alt={`صورة ${current + 1}`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchStartX = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchStartX;
          if (Math.abs(dx) > 40) {
            if (dx < 0) setCurrent((c) => (c + 1) % photos.length);
            else setCurrent((c) => (c - 1 + photos.length) % photos.length);
          }
        }}
        className="pop-in max-h-[85vh] max-w-[92vw] rounded-xl object-contain"
      />

      {photos.length > 1 && (
        <div
          className="absolute bottom-5 flex gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {photos.map((p, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`صورة ${i + 1}`}
              className={`h-2 w-2 rounded-full transition ${
                i === current ? 'bg-grape-light scale-125' : 'bg-white/30 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
