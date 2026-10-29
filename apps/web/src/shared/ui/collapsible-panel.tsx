import { useId, type ReactNode } from 'react';
import { Icon } from './icons';
import { usePersistedState } from './persisted-state';
import './collapsible-panel.css';

/** Props for {@link CollapsiblePanel}. */
export interface CollapsiblePanelProps {
  /** Section heading (16/600). */
  title: string;
  /** Optional muted line beside the title, kept visible while collapsed. */
  summary?: ReactNode;
  /** Remembers open/closed in this browser under this key, e.g. "devices.litter.open". */
  storageKey: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** A card section whose body can be folded; its open state survives a reload. */
export function CollapsiblePanel({
  title,
  summary,
  storageKey,
  defaultOpen = true,
  children,
}: CollapsiblePanelProps) {
  // Stored values come from localStorage and are validated here, not trusted.
  const [stored, setOpen] = usePersistedState<unknown>(storageKey, defaultOpen);
  const bodyId = useId();
  const isOpen = typeof stored === 'boolean' ? stored : defaultOpen;
  return (
    <section className="ui-collapsible">
      <h2 className="ui-collapsible__heading">
        <button
          type="button"
          className="ui-collapsible__toggle"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => {
            setOpen(!isOpen);
          }}
        >
          <span className="ui-collapsible__title">{title}</span>
          {summary && <span className="ui-collapsible__summary">{summary}</span>}
          <Icon name="chevron" size={16} className="ui-collapsible__chevron" />
        </button>
      </h2>
      <div id={bodyId} className="ui-collapsible__body" hidden={!isOpen}>
        {children}
      </div>
    </section>
  );
}
