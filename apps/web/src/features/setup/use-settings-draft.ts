import { useState } from 'react';
import { useSaveSettings } from './api';
import {
  defaultUpstream,
  draftProblem,
  withEdit,
  type LiveSettings,
  type ServerInfo,
  type SettingsDraft,
  type ToggleDef,
} from './setup-model';

/**
 * The unsaved settings of the Settings screen. Edits collect in a draft and are
 * saved together in one request, which the server applies all-or-nothing; the
 * header holds Save and Discard while the cards hold the rows, so they share it.
 * Turning a guard off asks first: it lets the real cloud reach the device.
 */
export function useSettingsDraft(info: ServerInfo) {
  const saved = info.settings;
  const fallback = defaultUpstream(info.upstreams);
  const [draft, setDraft] = useState<SettingsDraft>({});
  // Bumped on save and discard, so uncontrolled fields (the custom upstream) start over.
  const [generation, setGeneration] = useState(0);
  const [asking, setAsking] = useState<ToggleDef | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const save = useSaveSettings();

  const value: LiveSettings = { ...saved, ...draft };
  const dirty = Object.keys(draft) as (keyof LiveSettings)[];

  function edit<K extends keyof LiveSettings>(key: K, next: LiveSettings[K]) {
    setNotice(null);
    save.reset();
    setDraft(d => withEdit(d, saved, key, next, fallback));
  }

  return {
    value,
    draft,
    dirty,
    problem: draftProblem(draft, info.upstreams),
    writable: info.settings_writable,
    generation,
    notice,
    save,
    asking,
    edit,
    toggle: (def: ToggleDef, checked: boolean) => {
      if (!checked && def.offWarning) {
        setAsking(def);
        return;
      }
      edit(def.key, checked);
    },
    discard: () => {
      setDraft({});
      setGeneration(g => g + 1);
      save.reset();
    },
    submit: () => {
      save.mutate(draft, {
        onSuccess: result => {
          setDraft({});
          setGeneration(g => g + 1);
          const keys = Object.keys(result.changed);
          setNotice(`Saved ${keys.length === 1 ? '1 setting' : `${keys.length} settings`}.`);
        },
      });
    },
    cancelAsk: () => {
      setAsking(null);
    },
    confirmAsk: () => {
      if (asking) edit(asking.key, false);
      setAsking(null);
    },
  };
}

export type SettingsDraftState = ReturnType<typeof useSettingsDraft>;
