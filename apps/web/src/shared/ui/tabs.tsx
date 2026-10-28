import type { KeyboardEvent, ReactNode } from 'react';
import './tabs.css';

/** One tab or chip choice. */
export interface TabItem<Id extends string = string> {
  id: Id;
  label: string;
  disabled?: boolean;
}

/** DOM id of a tab button, for `aria-labelledby` on its panel. */
export function tabId(idPrefix: string, id: string): string {
  return `${idPrefix}-tab-${id}`;
}

/** DOM id of a tab panel, for `aria-controls` on its tab. */
export function tabPanelId(idPrefix: string, id: string): string {
  return `${idPrefix}-panel-${id}`;
}

/** Props for {@link Tabs}. */
export interface TabsProps<Id extends string> {
  /** Accessible name of the tab list. */
  label: string;
  /** Prefix for tab and panel ids; unique on the page. */
  idPrefix: string;
  tabs: readonly TabItem<Id>[];
  selected: Id;
  onSelect: (id: Id) => void;
}

/** Underlined tab list (ARIA tabs, arrow keys move between tabs; the selected tab gets the accent line). */
export function Tabs<Id extends string>({
  label,
  idPrefix,
  tabs,
  selected,
  onSelect,
}: TabsProps<Id>) {
  const enabled = tabs.filter(t => !t.disabled);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = enabled.findIndex(t => t.id === selected);
    let next: TabItem<Id> | undefined;
    if (event.key === 'ArrowRight') next = enabled[(index + 1) % enabled.length];
    else if (event.key === 'ArrowLeft')
      next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === 'Home') next = enabled[0];
    else if (event.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    event.preventDefault();
    onSelect(next.id);
    document.getElementById(tabId(idPrefix, next.id))?.focus();
  };
  return (
    <div className="ui-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map(t => {
        const isSelected = t.id === selected;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={tabId(idPrefix, t.id)}
            aria-selected={isSelected}
            aria-controls={tabPanelId(idPrefix, t.id)}
            tabIndex={isSelected ? 0 : -1}
            disabled={t.disabled}
            className="ui-tabs__tab"
            onClick={() => {
              onSelect(t.id);
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Props for {@link TabPanel}. */
export interface TabPanelProps {
  idPrefix: string;
  /** The tab this panel belongs to. */
  tab: string;
  children: ReactNode;
}

/** Panel for the selected tab; render only the selected one. */
export function TabPanel({ idPrefix, tab, children }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={tabPanelId(idPrefix, tab)}
      aria-labelledby={tabId(idPrefix, tab)}
      tabIndex={0}
      className="ui-tab-panel"
    >
      {children}
    </div>
  );
}

/** Props for {@link SegmentedChips}. */
export interface SegmentedChipsProps<Id extends string> {
  /** Accessible name of the group, e.g. "Cat shown in colour". */
  label: string;
  options: readonly TabItem<Id>[];
  value: Id;
  onChange: (id: Id) => void;
}

/** A row of 28px toggle chips (`aria-pressed`); the chosen chip gets an accent border, never a fill. */
export function SegmentedChips<Id extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedChipsProps<Id>) {
  return (
    <div className="ui-chips" role="group" aria-label={label}>
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          className="ui-chips__chip"
          aria-pressed={o.id === value}
          disabled={o.disabled}
          onClick={() => {
            onChange(o.id);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
