import { useRef } from 'react';
import { TextInput } from '@/shared/ui';

interface PetNameEditorProps {
  name: string;
  /** Called once per edit: the new name to save, or null to keep the old one. */
  onDone: (name: string | null) => void;
}

/**
 * Rename in place, the way every other edit on this screen works. A pet
 * imported from PetKit arrives as "PetKit pet 101392625", a name nobody wants
 * to keep, so this is used more than it looks.
 */
export function PetNameEditor({ name, onDone }: PetNameEditorProps) {
  // Enter, Escape and blur can all arrive for one edit (blur fires again when
  // the input unmounts), so the first one to finish wins and the rest are
  // no-ops. Without the latch a rename saves twice and Escape saves anyway.
  const done = useRef(false);
  const finish = (value: string | null) => {
    if (done.current) return;
    done.current = true;
    const trimmed = value?.trim() ?? '';
    onDone(trimmed && trimmed !== name ? trimmed : null);
  };

  return (
    <TextInput
      className="max-w-[260px] min-w-0 flex-1"
      aria-label="Pet name"
      defaultValue={name}
      autoFocus
      onFocus={e => {
        e.currentTarget.select();
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(e.currentTarget.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finish(null);
        }
      }}
      onBlur={e => {
        finish(e.currentTarget.value);
      }}
    />
  );
}
