import type { ReactNode } from 'react';
import type { Dictionary } from '@/lib/i18n-dictionaries';
import { SectionHead } from './section-head';

const stroke = { fill: 'none', stroke: 'var(--lp-drawing-stroke)', strokeWidth: 3 } as const;

// Codenames per hardware family; `ok` marks models somebody has run against the server
const FAMILIES: { id: keyof Dictionary['families']['items']; codes: [string, boolean][]; drawing: ReactNode }[] = [
  {
    id: 'camera',
    codes: [['T5', true], ['T6', true], ['T7', false], ['D4H', false], ['D4SH', true], ['W7H', true]],
    drawing: (
      <>
        <rect x="10" y="12" width="68" height="60" rx="14" {...stroke} fill="var(--lp-drawing-fill)" />
        <circle cx="44" cy="40" r="14" {...stroke} fill="var(--lp-litter)" />
        <circle cx="44" cy="40" r="5" fill="var(--lp-drawing-stroke)" />
        <rect x="22" y="72" width="44" height="6" rx="3" fill="var(--lp-drawing-stroke)" />
      </>
    ),
  },
  {
    id: 'esp32',
    codes: [['T3', false], ['T4', false], ['D3', false], ['D4', false], ['D4S', false], ['Feeder', false], ['Mini', false]],
    drawing: (
      <>
        <rect x="18" y="10" width="52" height="64" rx="12" {...stroke} fill="var(--lp-drawing-fill)" />
        <path d="M18 46 H70 V62 a12 12 0 0 1 -12 12 H30 a12 12 0 0 1 -12 -12 Z" {...stroke} fill="var(--lp-food)" />
        <rect x="30" y="20" width="28" height="14" rx="4" {...stroke} />
      </>
    ),
  },
  {
    id: 'bluetooth',
    codes: [['W4', false], ['W5', false], ['CTW2', false], ['CTW3', true], ['K2', false], ['K3', false]],
    drawing: (
      <>
        <path d="M16 40 h56 v18 a20 20 0 0 1 -20 20 h-16 a20 20 0 0 1 -20 -20 Z" {...stroke} fill="var(--lp-water)" />
        <path d="M44 12 c8 10 12 16 12 21 a12 12 0 0 1 -24 0 c0 -5 4 -11 12 -21z" {...stroke} fill="var(--lp-drawing-fill)" />
      </>
    ),
  },
];

/** Supported devices grouped by what is inside them, which decides how they connect. */
export function DeviceFamilies({ t }: { t: Dictionary['families'] }) {
  return (
    <section className="lp-block" id="devices">
      <div className="lp-wrap">
        <SectionHead eyebrow={t.eyebrow} title={t.title}>
          {t.lede}
        </SectionHead>
        <div className="lp-families" data-lp-reveal="">
          {FAMILIES.map((f) => (
            <article className="lp-family" key={f.id}>
              <svg viewBox="0 0 88 88" aria-hidden="true">
                {f.drawing}
              </svg>
              <h3>{t.items[f.id].title}</h3>
              <p>{t.items[f.id].body}</p>
              <div className="lp-codes">
                {f.codes.map(([code, ok]) => (
                  <span className="lp-code" data-ok={ok || undefined} key={code}>
                    {code}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
        <div className="lp-families-legend">
          <span className="lp-code" data-ok="">
            T6
          </span>
          {t.confirmed}
          <span className="lp-code">T7</span>
          {t.expected}
        </div>
      </div>
    </section>
  );
}
