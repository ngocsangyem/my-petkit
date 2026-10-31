import { useTranslation } from 'react-i18next';
import { Pill, SettingsSection, StepUpPill } from '@/shared/ui';
import {
  CAPTURE_TOGGLE,
  GUARD_TOGGLES,
  isBlockingGuard,
  PROXY_TOGGLE,
  type ServerInfo,
  type ToggleDef,
} from '../setup-model';
import type { SettingsDraftState } from '../use-settings-draft';
import { ToggleRow } from './toggle-row';
import { UpstreamFields } from './upstream-fields';
import { UpstreamStatus } from './upstream-status';

/** The guards that refuse something outright head the screen; the rest of the proxy options follow it. */
const BLOCKING = GUARD_TOGGLES.filter(def => isBlockingGuard(def.key));
const PROXY_OPTIONS = GUARD_TOGGLES.filter(def => !isBlockingGuard(def.key));

interface CardProps {
  form: SettingsDraftState;
}

function Row({ form, def }: CardProps & { def: ToggleDef }) {
  const inactive = def.needsProxy && !form.value.proxy_mode;
  return (
    <ToggleRow
      def={def}
      checked={form.value[def.key]}
      disabled={!form.writable || inactive || form.save.isPending}
      inactive={inactive}
      pending={def.key in form.draft}
      onChange={checked => {
        form.toggle(def, checked);
      }}
    />
  );
}

/**
 * What this server refuses to pass on from PetKit's cloud. Hiding "the RCE guard is on" while the
 * proxy is off would be worse than showing it inactive, so the guards stay listed and grey out.
 */
export function CloudGuardsCard({ form }: CardProps) {
  const { t } = useTranslation('setup');
  const off = BLOCKING.filter(def => !form.value[def.key]).length;
  return (
    <SettingsSection
      title={t('guards.title')}
      end={
        off === 0 ? (
          <Pill tone="positive">{t('guards.allOn')}</Pill>
        ) : (
          <Pill tone="warning">{t('guards.off', { n: off })}</Pill>
        )
      }
    >
      {BLOCKING.map(def => (
        <Row key={def.key} form={form} def={def} />
      ))}
      <p className="py-2 text-xs text-muted-foreground">{t('guards.note')}</p>
    </SettingsSection>
  );
}

/** Proxy mode, its other options, the upstream, what it forwarded, and traffic capture. */
export function ProxyModeCard({ form, info }: CardProps & { info: ServerInfo }) {
  const { t } = useTranslation('setup');
  return (
    <SettingsSection title={t('proxy.title')} end={<StepUpPill>{t('proxy.stepUp')}</StepUpPill>}>
      <Row form={form} def={PROXY_TOGGLE} />
      {PROXY_OPTIONS.map(def => (
        <Row key={def.key} form={form} def={def} />
      ))}
      <UpstreamFields
        key={form.generation}
        presets={info.upstreams}
        upstream={form.value.proxy_upstream}
        dns={form.value.proxy_dns}
        disabled={!form.writable || !form.value.proxy_mode || form.save.isPending}
        onUpstream={v => {
          form.edit('proxy_upstream', v);
        }}
        onDns={v => {
          form.edit('proxy_dns', v.trim());
        }}
      />
      {info.settings.proxy_mode && <UpstreamStatus counts={info.upstream} />}
      <Row form={form} def={CAPTURE_TOGGLE} />
    </SettingsSection>
  );
}
