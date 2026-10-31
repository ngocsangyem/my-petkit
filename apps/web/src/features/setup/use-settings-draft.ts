import { useState } from 'react';
import { useSaveSettings } from './api';
import {
  defaultUpstream,
  draftProblem,
  isBlockingGuard,
  withEdit,
  type GuardKey,
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
  const [asking, setAsking] = useState<GuardKey | null>(null);
  // How many settings the last save changed; the header words it in the active language.
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const save = useSaveSettings();

  const value: LiveSettings = { ...saved, ...draft };
  const dirty = Object.keys(draft) as (keyof LiveSettings)[];

  function edit<K extends keyof LiveSettings>(key: K, next: LiveSettings[K]) {
    setSavedCount(null);
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
    savedCount,
    save,
    asking,
    edit,
    toggle: (def: ToggleDef, checked: boolean) => {
      if (!checked && isBlockingGuard(def.key)) {
        setAsking(def.key);
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
          setSavedCount(Object.keys(result.changed).length);
        },
      });
    },
    cancelAsk: () => {
      setAsking(null);
    },
    confirmAsk: () => {
      if (asking) edit(asking, false);
      setAsking(null);
    },
  };
}

export type SettingsDraftState = ReturnType<typeof useSettingsDraft>;
