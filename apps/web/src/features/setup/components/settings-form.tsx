import { useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { Button, ConfirmDialog, SettingsSection } from '@/shared/ui';
import { useSaveSettings } from '../api';
import {
  CAPTURE_TOGGLE,
  defaultUpstream,
  draftProblem,
  GUARD_TOGGLES,
  PROXY_TOGGLE,
  withEdit,
  type LiveSettings,
  type ServerInfo,
  type SettingsDraft,
  type ToggleDef,
} from '../setup-model';
import { ToggleRow } from './toggle-row';
import { UpstreamFields } from './upstream-fields';
import { UpstreamStatus } from './upstream-status';

/**
 * Proxy mode, its guards, the upstream and capture. Edits collect in a draft and
 * are saved together in one request, which the server applies all-or-nothing.
 * Turning a guard off asks first: it lets the real cloud reach the device.
 */
export function SettingsForm({ info }: { info: ServerInfo }) {
  const saved = info.settings;
  const writable = info.settings_writable;
  const fallback = defaultUpstream(info.upstreams);
  const [draft, setDraft] = useState<SettingsDraft>({});
  const [generation, setGeneration] = useState(0);
  const [asking, setAsking] = useState<ToggleDef | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const save = useSaveSettings();

  const value: LiveSettings = { ...saved, ...draft };
  const dirty = Object.keys(draft) as (keyof LiveSettings)[];
  const problem = draftProblem(draft, info.upstreams);

  function edit<K extends keyof LiveSettings>(key: K, next: LiveSettings[K]) {
    setNotice(null);
    save.reset();
    setDraft(d => withEdit(d, saved, key, next, fallback));
  }

  function toggle(def: ToggleDef, checked: boolean) {
    if (!checked && def.offWarning) {
      setAsking(def);
      return;
    }
    edit(def.key, checked);
  }

  function discard() {
    setDraft({});
    setGeneration(g => g + 1);
    save.reset();
  }

  function submit() {
    save.mutate(draft, {
      onSuccess: result => {
        setDraft({});
        setGeneration(g => g + 1);
        const keys = Object.keys(result.changed);
        setNotice(`Saved ${keys.length === 1 ? '1 setting' : `${keys.length} settings`}.`);
      },
    });
  }

  const row = (def: ToggleDef) => {
    const inactive = def.needsProxy && !value.proxy_mode;
    return (
      <ToggleRow
        key={def.key}
        def={def}
        checked={value[def.key]}
        disabled={!writable || inactive || save.isPending}
        inactive={inactive}
        pending={def.key in draft}
        onChange={checked => {
          toggle(def, checked);
        }}
      />
    );
  };

  return (
    <>
      <SettingsSection
        title="Cloud guards"
        description="What this server refuses to pass on from PetKit's cloud. The guards act only while the proxy is on. Every change here asks for your password."
      >
        {row(PROXY_TOGGLE)}
        {GUARD_TOGGLES.map(row)}
      </SettingsSection>
      <SettingsSection
        title="Upstream and capture"
        description="Where proxied requests go, and whether traffic is saved. The upstream is only used while the proxy is on."
      >
        <UpstreamFields
          key={generation}
          presets={info.upstreams}
          upstream={value.proxy_upstream}
          dns={value.proxy_dns}
          disabled={!writable || !value.proxy_mode || save.isPending}
          onUpstream={v => {
            edit('proxy_upstream', v);
          }}
          onDns={v => {
            edit('proxy_dns', v.trim());
          }}
        />
        {row(CAPTURE_TOGGLE)}
        {saved.proxy_mode && <UpstreamStatus counts={info.upstream} />}
      </SettingsSection>

      {(dirty.length > 0 || notice || save.isError) && (
        <div className="setup-savebar" role="region" aria-label="Unsaved settings">
          <div className="setup-savebar__text" role="status">
            {save.isError ? (
              <span className="setup-error">Nothing was saved: {errorMessage(save.error)}</span>
            ) : problem ? (
              <span className="setup-error">{problem}</span>
            ) : dirty.length > 0 ? (
              <span>
                {dirty.length === 1 ? '1 unsaved change' : `${dirty.length} unsaved changes`}:{' '}
                <span className="setup-mono">{dirty.join(', ')}</span>. Saving asks for your
                password.
              </span>
            ) : (
              <span>{notice}</span>
            )}
          </div>
          {dirty.length > 0 && (
            <div className="setup-savebar__actions">
              <Button onClick={discard} disabled={save.isPending}>
                Discard
              </Button>
              <Button
                variant="primary"
                onClick={submit}
                disabled={save.isPending || problem !== null}
              >
                {save.isPending ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={asking !== null}
        title={`Turn off “${asking?.label ?? ''}”?`}
        confirmLabel="Turn off"
        onCancel={() => {
          setAsking(null);
        }}
        onConfirm={() => {
          if (asking) edit(asking.key, false);
          setAsking(null);
        }}
      >
        <p>{asking?.offWarning}</p>
        <p>Nothing changes until you save.</p>
      </ConfirmDialog>
    </>
  );
}
