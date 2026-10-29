import type { ReactNode } from 'react';
import { Badge } from './shadcn/badge';

/** Pill colour pairs from the tokens. */
export type PillTone = 'positive' | 'negative' | 'warning' | 'neutral';

/** Props for {@link Pill}. */
export interface PillProps {
  tone?: PillTone;
  children: ReactNode;
}

/** 20px pill placed beside a value or a title only, never as a row fill. */
export function Pill({ tone = 'neutral', children }: PillProps) {
  return <Badge variant={tone}>{children}</Badge>;
}
