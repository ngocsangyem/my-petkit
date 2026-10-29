import type { ReactNode } from 'react';
import './pill.css';

/** Pill colour pairs from the tokens. */
export type PillTone = 'positive' | 'negative' | 'warning' | 'neutral';

/** Props for {@link Pill}. */
export interface PillProps {
  tone?: PillTone;
  children: ReactNode;
}

/** 20px pill placed beside a value or a title only, never as a row fill. */
export function Pill({ tone = 'neutral', children }: PillProps) {
  return <span className={`ui-pill ui-pill--${tone}`}>{children}</span>;
}
