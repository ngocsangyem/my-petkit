import type { ReactNode } from 'react';
import { Icon } from './icons';
import { Pill } from './pill';

/** Props for {@link StepUpPill}. */
export interface StepUpPillProps {
  /** Defaults to "Step-up required"; settings rows use the short "Step-up". */
  children?: ReactNode;
}

/** 22px negative pill placed beside a title or setting that needs step-up (R3). */
export function StepUpPill({ children = 'Step-up required' }: StepUpPillProps) {
  return <Pill tone="negative">{children}</Pill>;
}

/** Props for {@link RiskNotice}. */
export interface RiskNoticeProps {
  /** One warning paragraph that includes the undo sentence. */
  children: ReactNode;
}

/**
 * The single warning paragraph of a step-up screen: a `raised` box (radius 16) with one 16px red
 * icon and the sentence in the lede colour.
 */
export function RiskNotice({ children }: RiskNoticeProps) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-raised px-3.5 py-3 text-lede">
      <Icon name="warning" size={16} strokeWidth={2} className="mt-0.5 flex-none text-negative" />
      <p className="max-w-[72ch]">{children}</p>
    </div>
  );
}
