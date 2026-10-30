import { cn } from 'cn';
import { Pill } from '@/shared/ui';
import { summariseUpstream } from '../setup-model';

/** Set off from the rows above by a rule, inside the same panel. */
const FRAME = 'flex flex-col gap-1.5 border-t border-rule py-3';

/**
 * What proxy mode is actually doing. Once a taken-over device settles it polls
 * only the heartbeat, PetKit refuses that and we answer locally, so nothing
 * else on screen would differ from the proxy being off. This line says it runs.
 */
export function UpstreamStatus({ counts }: { counts: Record<string, number> }) {
  const s = summariseUpstream(counts);
  if (!s.total) {
    return (
      <p className={cn(FRAME, 'text-sm text-muted-foreground')}>
        No calls forwarded yet. A device polls about every 10 seconds.
      </p>
    );
  }
  return (
    <div className={FRAME}>
      <p className="flex flex-wrap items-center gap-2">
        <span>
          Forwarded <span className="tabular-nums">{s.total}</span> calls
        </span>
        <Pill tone={s.ok ? 'positive' : 'neutral'}>{s.ok} answered</Pill>
        {s.refused.map(r => (
          <Pill key={`e-${r.code}`} tone="warning">
            {r.count} refused ({r.code})
          </Pill>
        ))}
        {s.failed.map(f => (
          <Pill key={`h-${f.status}`} tone="negative">
            {f.count} × HTTP {f.status}
          </Pill>
        ))}
      </p>
      {s.refused.length > 0 && !s.ok && (
        <p className="text-sm text-muted-foreground">
          The cloud refuses every session-bearing call. That is expected once this server has taken
          the device over, since the session it presents is one we issued; the device is served our
          own answers throughout.
        </p>
      )}
    </div>
  );
}
