import { cn } from 'cn';
import { Icon, Pill, type IconName } from '@/shared/ui';
import type { PatcherEntry, PatcherId } from '../api';
import { isFinalLine, primaryAction, statusOf, type StatusTone } from '../patcher-model';

/** Status word colour per tone: the word carries the state, never a fill. */
const TONE: Record<StatusTone, string> = {
  positive: 'text-positive',
  warning: 'text-warning',
  muted: 'text-muted-foreground',
};

/** What each patch touches, as a glyph beside its name. */
const ICON: Record<PatcherId, IconName> = {
  camera: 'video',
  mqtt: 'wifi',
  pan: 'camera',
  talk: 'phone',
  cloud: 'cloud',
  cacert: 'lock',
  ssh: 'key',
};

interface PatchListProps {
  patchers: readonly PatcherEntry[];
  /** Name of the device the patches run on, for each row's second line. */
  deviceName: string;
  /** Progress lines per patcher id, for the "Running" state. */
  linesOf: (patcherId: string) => readonly string[] | undefined;
  selected: string | null;
  onPick: (patcher: PatcherEntry, action: 'apply' | 'remove') => void;
}

function running(lines: readonly string[] | undefined): boolean {
  const last = lines?.at(-1);
  return last !== undefined && !isFinalLine(last) && !last.startsWith('ERROR');
}

/**
 * One row per patcher: its glyph, name, device and state; an applied patch carries the
 * "Applied" pill. A row opens the patch on the right, set to remove what is in place and apply
 * what is not.
 */
export function PatchList({ patchers, deviceName, linesOf, selected, onPick }: PatchListProps) {
  return (
    <ul className="m-0 flex list-none flex-col p-0" aria-label="Patches">
      {patchers.map(p => {
        const action = primaryAction(p);
        const status = statusOf(p);
        const busy = running(linesOf(p.id));
        const current = p.id === selected;
        return (
          <li key={p.id} className="[&+&]:border-t [&+&]:border-rule">
            <button
              type="button"
              aria-label={`${action === 'apply' ? 'Apply' : 'Remove'} ${p.name}…`}
              aria-current={current || undefined}
              onClick={() => {
                onPick(p, action);
              }}
              className={cn(
                'flex min-h-16 w-full items-center gap-3 rounded-md border-l-2 border-transparent px-2.5 text-left hover:bg-raised',
                current && 'border-data bg-raised',
              )}
            >
              <Icon name={ICON[p.id]} size={18} className="flex-none text-muted-foreground" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {deviceName}
                  {/* "Applied" is the pill's word; the line keeps every other state. */}
                  {busy ? (
                    <>
                      {' · '}
                      <span className="text-data">Running…</span>
                    </>
                  ) : status.text === 'Applied' ? null : (
                    <>
                      {' · '}
                      <span className={TONE[status.tone]}>{status.text}</span>
                    </>
                  )}
                </span>
              </span>
              {action === 'remove' && !busy ? (
                <Pill tone="positive">Applied</Pill>
              ) : (
                <Icon
                  name="chevron"
                  size={16}
                  className="flex-none -rotate-90 text-muted-foreground"
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
