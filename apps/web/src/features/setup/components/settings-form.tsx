import { Pill, StepUpPill } from '@/shared/ui';
import {
  BLOCKING_GUARDS,
  CAPTURE_TOGGLE,
  GUARD_TOGGLES,
  PROXY_TOGGLE,
  type ServerInfo,
  type ToggleDef,
} from '../setup-model';
import type { SettingsDraftState } from '../use-settings-draft';
import { SettingsCard } from './settings-card';
import { ToggleRow } from './toggle-row';
import { UpstreamFields } from './upstream-fields';
import { UpstreamStatus } from './upstream-status';

/** The guards that refuse something outright head the screen; the rest of the proxy options follow it. */
const BLOCKING = GUARD_TOGGLES.filter(def => BLOCKING_GUARDS.includes(def.key));
const PROXY_OPTIONS = GUARD_TOGGLES.filter(def => !BLOCKING_GUARDS.includes(def.key));

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
  const off = BLOCKING.filter(def => !form.value[def.key]).length;
  return (
    <SettingsCard
      title="Cloud guards"
      end={
        off === 0 ? <Pill tone="positive">All on</Pill> : <Pill tone="warning">{`${off} off`}</Pill>
      }
    >
      {BLOCKING.map(def => (
        <Row key={def.key} form={form} def={def} />
      ))}
      <p className="py-2 text-xs text-muted-foreground">
        Turning a guard off asks first, and saving asks for your password. The guards act only while
        proxy mode is on.
      </p>
    </SettingsCard>
  );
}

/** Proxy mode, its other options, the upstream, what it forwarded, and traffic capture. */
export function ProxyModeCard({ form, info }: CardProps & { info: ServerInfo }) {
  return (
    <SettingsCard title="Proxy mode" end={<StepUpPill>Step-up</StepUpPill>}>
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
    </SettingsCard>
  );
}
