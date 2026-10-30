import { useState } from 'react';
import { Select, SettingsRow, StepUpPill, TextInput } from '@/shared/ui';
import { defaultUpstream, validDns, validUpstream, type UpstreamChoice } from '../setup-model';

const CUSTOM = '__custom__';

interface UpstreamFieldsProps {
  presets: readonly UpstreamChoice[];
  /** The upstream and resolver as they would be saved (draft over saved). */
  upstream: string;
  dns: string;
  disabled: boolean;
  onUpstream: (value: string) => void;
  onDns: (value: string) => void;
}

/**
 * The upstream picker and the resolver. An empty setting means the server's
 * default preset, which the server flags, so the picker shows it selected.
 * "Custom…" only reveals the text box: nothing changes until a real value is
 * typed, so switching to it does not blank a working upstream.
 */
export function UpstreamFields({
  presets,
  upstream,
  dns,
  disabled,
  onUpstream,
  onDns,
}: UpstreamFieldsProps) {
  const fallback = defaultUpstream(presets);
  const current = upstream || fallback;
  const isPreset = presets.some(p => p.key === current);
  const [custom, setCustom] = useState(!isPreset);
  const [customText, setCustomText] = useState(isPreset ? '' : upstream);
  const selected = custom || !isPreset ? CUSTOM : current;
  const presetUrl = presets.find(p => p.key === current)?.url;

  const options = [
    ...presets.map(p => ({ value: p.key, label: p.default ? `${p.key} (default)` : p.key })),
    { value: CUSTOM, label: 'Custom…' },
  ];

  return (
    <>
      <SettingsRow
        kind="field"
        label="Upstream host"
        configKey="proxy_upstream"
        badge={<StepUpPill>Step-up</StepUpPill>}
        description={
          selected === CUSTOM ? (
            'A PetKit or Aliyun IoT URL. Every device request is forwarded there with its credential.'
          ) : (
            <span className="font-mono text-xs wrap-anywhere">{presetUrl}</span>
          )
        }
        control={props => (
          <Select
            {...props}
            className="w-full"
            options={options}
            value={selected}
            disabled={disabled}
            onChange={e => {
              const value = e.target.value;
              if (value === CUSTOM) {
                setCustom(true);
                if (customText.trim()) onUpstream(customText.trim());
                return;
              }
              setCustom(false);
              onUpstream(value);
            }}
          />
        )}
      />
      {selected === CUSTOM && (
        <SettingsRow
          kind="field"
          label="Custom upstream URL"
          control={props => (
            <TextInput
              {...props}
              mono
              alignEnd
              type="url"
              placeholder="https://api.eu-pet.com/6/"
              value={customText}
              disabled={disabled}
              aria-invalid={!validUpstream(customText, presets) || undefined}
              onChange={e => {
                setCustomText(e.target.value);
                if (e.target.value.trim()) onUpstream(e.target.value.trim());
              }}
            />
          )}
        />
      )}
      <SettingsRow
        kind="field"
        label="Upstream resolver"
        configKey="proxy_dns"
        badge={<StepUpPill>Step-up</StepUpPill>}
        description="Only used to find the server above. Leave empty unless your router or Pi-hole points PetKit's names at this server: then it would point them here for us too, and the proxy would reach itself instead of the cloud."
        control={props => (
          <TextInput
            {...props}
            mono
            alignEnd
            placeholder="System resolver"
            value={dns}
            disabled={disabled}
            aria-invalid={!validDns(dns) || undefined}
            onChange={e => {
              onDns(e.target.value);
            }}
          />
        )}
      />
    </>
  );
}
