import type { QueryKey } from '@tanstack/react-query';
import { type CSSProperties, type ReactNode, useState } from 'react';
import { ConfirmDialog, type IconName, QuickAction } from '@/shared/ui';
import { type Feedback, useDeviceCall } from '../hooks/use-device-call';
import { FeedbackLine } from './panel-parts';

/** One command button. */
export interface Command {
  key: string;
  name: string;
  /** Destructive commands sit in their own group, after the others. */
  destructive: boolean;
  run: () => Promise<string>;
}

/** The icon above a command's label, by the words in its key; a plain arrow otherwise. */
export function commandIcon(key: string): IconName {
  const k = key.toLowerCase();
  if (k.includes('clean') && !k.includes('cancel')) return 'clean';
  if (k.includes('pack') || k.includes('bag')) return 'bag';
  if (k.includes('level')) return 'level';
  if (k.includes('deodor') || k.includes('spray') || k.includes('odor')) return 'leaf';
  if (k.includes('light')) return 'light';
  if (k.includes('dump') || k.includes('empty')) return 'trash';
  if (k.includes('water') || k.includes('refill') || k.includes('drain')) return 'drop';
  if (k.includes('feed') || k.includes('food')) return 'plus';
  if (k.includes('cancel') || k.includes('stop') || k.includes('pause')) return 'pause';
  if (k.includes('reset')) return 'refresh';
  if (k.includes('sound') || k.includes('play')) return 'play';
  if (k.includes('reboot') || k.includes('restart')) return 'refresh';
  return 'forward';
}

interface CommandsOptions {
  /** "litter box", for the confirm's question. */
  target: string;
  /** What happens on the wire, said in the confirm. */
  route: string;
  refresh: readonly QueryKey[];
}

/** What a page needs to run commands: one confirm, one busy flag, one answer line. */
export interface CommandRunner {
  ask: (command: Command) => void;
  busy: boolean;
  feedback: Feedback | null;
  /** The confirm dialog; render it once. */
  dialog: ReactNode;
}

/**
 * Device commands (R2). Every command asks before it runs, wherever its button sits (a quick
 * action, the page header, the live view's bar). The confirm's title is a question and its body
 * says what moves and how it gets there.
 */
export function useCommands({ target, route, refresh }: CommandsOptions): CommandRunner {
  const call = useDeviceCall();
  const [asking, setAsking] = useState<Command | null>(null);

  const confirm = async () => {
    const cmd = asking;
    if (!cmd) return;
    await call.run(async () => `Last command: ${cmd.name} · ${await cmd.run()}`, refresh);
    setAsking(null);
  };

  const dialog = (
    <ConfirmDialog
      open={asking !== null}
      title={`${asking?.name ?? ''} on the ${target}?`}
      confirmLabel={asking?.name ?? 'Send'}
      busy={call.busy}
      onConfirm={() => void confirm()}
      onCancel={() => {
        setAsking(null);
      }}
    >
      <p>
        This sends “{asking?.name}” to the {target}. {route}
      </p>
      {asking?.destructive && <p>The device acts on it at once and it cannot be called back.</p>}
    </ConfirmDialog>
  );
  return { ask: setAsking, busy: call.busy, feedback: call.feedback, dialog };
}

interface CommandListProps {
  commands: readonly Command[];
  runner: CommandRunner;
  /** A button that needs no confirmation (a read request, not a command), first in the grid. */
  extra?: ReactNode;
  /** The muted line under the grid; defaults to "Each command asks before it runs." */
  note?: string;
}

/** Minimum width of one quick action, and the gap between two. */
const ACTION_MIN = 124;
const ACTION_GAP = 8;

/** A flex share for a block of `n` quick actions: grows by `n`, never narrower than `n` actions. */
function share(n: number): CSSProperties {
  return { flex: `${String(n)} 1 ${String(n * ACTION_MIN + (n - 1) * ACTION_GAP)}px` };
}

/**
 * The quick-action grid of a device: routine commands as icon-over-label buttons, destructive ones
 * in a labelled group of their own after the rest. Destructive commands are not red: red is once
 * per object, and the group label and the confirm say what they do.
 */
export function CommandList({ commands, runner, extra, note }: CommandListProps) {
  const routine = commands.filter(cmd => !cmd.destructive);
  const destructive = commands.filter(cmd => cmd.destructive);
  const button = (cmd: Command) => (
    <QuickAction
      key={cmd.key}
      icon={commandIcon(cmd.key)}
      label={cmd.name}
      disabled={runner.busy}
      onClick={() => {
        runner.ask(cmd);
      }}
    />
  );
  // auto-fit, not auto-fill: empty tracks collapse, so the buttons stretch across the card.
  const grid = 'grid grid-cols-[repeat(auto-fit,minmax(124px,1fr))] gap-2';
  const routineCount = routine.length + (extra ? 1 : 0);
  return (
    <section className="flex min-w-0 flex-col gap-2.5" aria-label="Commands">
      {/*
        One row across the card: the routine block and the destructive group grow in proportion
        to how many buttons each holds, so every button is the same width, and the row wraps
        only when the card is too narrow for all of them.
      */}
      <div className="flex flex-wrap items-end gap-2">
        {routineCount > 0 && (
          <div className={grid} style={share(routineCount)}>
            {extra}
            {routine.map(button)}
          </div>
        )}
        {destructive.length > 0 && (
          <div
            className="grid gap-1.5"
            role="group"
            aria-label="Cannot be undone"
            style={share(destructive.length)}
          >
            <span className="text-sm text-muted-foreground">Cannot be undone</span>
            <div className={grid}>{destructive.map(button)}</div>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{note ?? 'Each command asks before it runs.'}</p>
      <FeedbackLine feedback={runner.feedback} />
    </section>
  );
}
