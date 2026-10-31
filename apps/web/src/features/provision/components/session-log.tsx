import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyBlock, Panel } from '@/shared/ui';
import type { LogLine } from '../hooks/use-provision-session';

/** The Bluetooth exchange, newest last, kept scrolled to the end. Device text renders as text. */
export function SessionLog({ lines }: { lines: readonly LogLine[] }) {
  const { t } = useTranslation('provision');
  const headingId = useId();
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines]);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1.5">
      <h3 id={headingId} className="text-sm font-normal text-muted-foreground">
        {t('log.title')}
      </h3>
      {lines.length === 0 ? (
        <EmptyBlock>{t('log.empty')}</EmptyBlock>
      ) : (
        <Panel
          padding="none"
          role="log"
          aria-labelledby={headingId}
          className="flex max-h-[320px] flex-col gap-1.5 overflow-auto px-3.5 py-2.5"
          ref={box}
        >
          {lines.map(l => (
            <div
              key={l.id}
              className="border-l-2 border-border pl-2.5 font-mono text-xs leading-[1.45] whitespace-pre-wrap wrap-anywhere"
            >
              <span className="mr-2 text-muted-foreground tabular-nums">{l.time}</span>
              {l.text}
            </div>
          ))}
        </Panel>
      )}
    </section>
  );
}
