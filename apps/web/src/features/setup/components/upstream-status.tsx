import { Trans, useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('setup');
  const s = summariseUpstream(counts);
  if (!s.total) {
    return <p className={cn(FRAME, 'text-sm text-muted-foreground')}>{t('upstream.none')}</p>;
  }
  return (
    <div className={FRAME}>
      <p className="flex flex-wrap items-center gap-2">
        <span>
          <Trans
            t={t}
            i18nKey="upstream.forwarded"
            count={s.total}
            components={{ n: <span className="tabular-nums" /> }}
          />
        </span>
        <Pill tone={s.ok ? 'positive' : 'neutral'}>{t('upstream.answered', { n: s.ok })}</Pill>
        {s.refused.map(r => (
          <Pill key={`e-${r.code}`} tone="warning">
            {t('upstream.refused', { n: r.count, code: r.code })}
          </Pill>
        ))}
        {s.failed.map(f => (
          <Pill key={`h-${f.status}`} tone="negative">
            {f.count} × HTTP {f.status}
          </Pill>
        ))}
      </p>
      {s.refused.length > 0 && !s.ok && (
        <p className="text-sm text-muted-foreground">{t('upstream.refusedNote')}</p>
      )}
    </div>
  );
}
