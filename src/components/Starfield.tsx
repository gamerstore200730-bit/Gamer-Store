import { useMemo } from 'react';

export default function Starfield() {
  const stars = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        id: i,
        top: `${(i * 37 + 11) % 100}%`,
        left: `${(i * 53 + 7) % 100}%`,
        size: i % 5 === 0 ? 2 : 1,
        delay: `${(i % 9) * 0.5}s`,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-grape-light/60"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            animation: `twinkle 4s ease-in-out ${s.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}
