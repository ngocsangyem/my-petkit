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
    <section aria-labelledby={headingId} className="provision-log">
      <div className="provision-log__head">
        <h2 id={headingId}>Session log</h2>
        <span className="provision-muted">Bluetooth frames, newest last</span>
      </div>
      {lines.length === 0 ? (
        <EmptyBlock>Nothing sent yet. Each step and every reply lands here.</EmptyBlock>
      ) : (
        <div role="log" aria-labelledby={headingId} className="provision-log__box" ref={box}>
          {lines.map(l => (
            <div key={l.id} className="provision-log__line">
              <span className="provision-log__time">{l.time}</span> {l.text}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
