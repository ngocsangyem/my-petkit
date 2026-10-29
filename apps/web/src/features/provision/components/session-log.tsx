import { useEffect, useId, useRef } from 'react';
import { EmptyBlock } from '@/shared/ui';
import type { LogLine } from '../hooks/use-provision-session';

/** The Bluetooth exchange, newest last, kept scrolled to the end. Device text renders as text. */
export function SessionLog({ lines }: { lines: readonly LogLine[] }) {
  const headingId = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines]);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <h2 id={headingId}>Session log</h2>
        <span className="text-sm text-muted-foreground">Bluetooth frames, newest last</span>
      </div>
      {lines.length === 0 ? (
        <EmptyBlock>Nothing sent yet. Each step and every reply lands here.</EmptyBlock>
      ) : (
        <div
          role="log"
          aria-labelledby={headingId}
          className="max-h-[480px] overflow-auto rounded-lg bg-ink px-4 py-3 font-mono text-xs leading-[1.7] text-control dark:bg-ground dark:text-muted-foreground"
          ref={box}
        >
          {lines.map(l => (
            <div key={l.id} className="whitespace-pre-wrap wrap-anywhere">
              <span className="tabular-nums">{l.time}</span> {l.text}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
