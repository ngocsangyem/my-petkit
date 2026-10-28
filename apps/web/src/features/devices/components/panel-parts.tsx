import { type ReactNode, useId } from 'react';
import { Icon } from '@/shared/ui';
import type { Feedback } from '../hooks/use-device-call';

/** The status line under a block: the answer to the last thing it did. Polite live region. */
export function FeedbackLine({ feedback }: { feedback: Feedback | null }) {
  return (
    <p
      className={
        feedback?.tone === 'error' ? 'devices-feedback devices-feedback--error' : 'devices-feedback'
      }
      role="status"
    >
      {feedback?.text ?? ''}
    </p>
  );
}

interface PanelFrameProps {
  /** Anchor id, so the device list can link to the panel. */
  id: string;
  title: string;
  /** Kept visible while collapsed: status, model, last report. */
  summary: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rendered only while open: a collapsed panel costs no DOM and no refresh. */
  children: () => ReactNode;
}

/**
 * One collapsible device panel, drawn with the shared collapsible styles. It is
 * not the shared CollapsiblePanel because that one keeps its body mounted while
 * hidden; here a collapsed body must not exist at all.
 */
export function PanelFrame({ id, title, summary, open, onOpenChange, children }: PanelFrameProps) {
  const bodyId = useId();
  return (
    <section className="ui-collapsible devices-panel" id={id} aria-label={title}>
      <h2 className="ui-collapsible__heading">
        <button
          type="button"
          className="ui-collapsible__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => {
            onOpenChange(!open);
          }}
        >
          <span className="ui-collapsible__title">{title}</span>
          <span className="ui-collapsible__summary devices-panel__summary">{summary}</span>
          <Icon name="chevron" size={16} className="ui-collapsible__chevron" />
        </button>
      </h2>
      <div id={bodyId} className="ui-collapsible__body" hidden={!open}>
        {open && children()}
      </div>
    </section>
  );
}

interface DisclosureProps {
  summary: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/** A remembered `<details>` inside a panel (diagnostics, raw JSON, pairing, removal). */
export function Disclosure({ summary, open, onOpenChange, children }: DisclosureProps) {
  return (
    <details
      className="devices-disclosure"
      open={open}
      onToggle={e => {
        if (e.currentTarget.open !== open) onOpenChange(e.currentTarget.open);
      }}
    >
      <summary className="devices-disclosure__summary">{summary}</summary>
      {open && <div className="devices-disclosure__body">{children}</div>}
    </details>
  );
}

/** A labelled fact in a panel's metadata grid. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="devices-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** A block heading inside a panel (14/600), with an optional muted aside. */
export function BlockHeading({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="devices-block-heading">
      <h3>{title}</h3>
      {aside && <span className="devices-block-heading__aside">{aside}</span>}
    </div>
  );
}

/** Pretty JSON of a device's own words, as text in a mono block. */
export function JsonBlock({ value, label }: { value: unknown; label: string }) {
  return (
    <pre className="devices-json" aria-label={label}>
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}
