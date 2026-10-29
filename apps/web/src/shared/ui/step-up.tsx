import type { ReactNode } from 'react';
import { Icon } from './icons';
import { Pill } from './pill';
import './step-up.css';

/** Props for {@link StepUpPill}. */
export interface StepUpPillProps {
  /** Defaults to "Step-up required"; settings rows use the short "Step-up". */
  children?: ReactNode;
}

/** 20px negative pill placed beside a title or setting that needs step-up (R3). */
export function StepUpPill({ children = 'Step-up required' }: StepUpPillProps) {
  return <Pill tone="negative">{children}</Pill>;
}

/** Props for {@link RiskNotice}. */
export interface RiskNoticeProps {
  /** One warning paragraph that includes the undo sentence. */
  children: ReactNode;
}

/** The single warning paragraph of a step-up screen: on `raised`, with one 16px red icon. */
export function RiskNotice({ children }: RiskNoticeProps) {
  return (
    <div className="ui-risk">
      <Icon name="warning" size={16} strokeWidth={2} className="ui-risk__icon" />
      <p className="ui-risk__text">{children}</p>
    </div>
  );
}
