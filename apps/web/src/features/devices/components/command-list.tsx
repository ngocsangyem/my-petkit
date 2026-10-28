import type { QueryKey } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Button, ConfirmDialog } from '@/shared/ui';
import { useDeviceCall } from '../hooks/use-device-call';
import { FeedbackLine } from './panel-parts';

/** One command button. */
export interface Command {
  key: string;
  name: string;
  /** Destructive commands sit in their own group, after the others. */
  destructive: boolean;
  run: () => Promise<string>;
}

interface CommandListProps {
  commands: readonly Command[];
  /** "Litter box", for the confirm sheet's question. */
  target: string;
  /** What happens on the wire, said in the confirm sheet. */
  route: string;
  refresh: readonly QueryKey[];
  /** Commands that need no confirmation (a read request, not a command). */
  extra?: ReactNode;
}

/**
 * Device commands (R2): secondary buttons, destructive ones in a group of their
 * own after the rest, and each asks before it runs. Destructive commands are not
 * red: the design allows red once per object, and a panel can carry several of
 * them (dump litter, reset a consumable); the group label and the confirm sheet
 * say what they do. The confirm sheet's title is a question and its body says
 * what moves and how it gets there.
 */
export function CommandList({ commands, target, route, refresh, extra }: CommandListProps) {
  const call = useDeviceCall();
  const [asking, setAsking] = useState<Command | null>(null);
  const routine = commands.filter(cmd => !cmd.destructive);
  const destructive = commands.filter(cmd => cmd.destructive);
  const button = (cmd: Command) => (
    <Button
      key={cmd.key}
      variant="secondary"
      disabled={call.busy}
      onClick={() => {
        setAsking(cmd);
      }}
    >
      {cmd.name}
    </Button>
  );

  const confirm = async () => {
    const cmd = asking;
    if (!cmd) return;
    await call.run(async () => `Last command: ${cmd.name} · ${await cmd.run()}`, refresh);
    setAsking(null);
  };

  return (
    <div className="devices-stack">
      <div className="devices-command-row">
        {extra}
        {routine.map(button)}
      </div>
      {destructive.length > 0 && (
        <div className="devices-command-group" role="group" aria-label="Cannot be undone">
          <span className="devices-note">Cannot be undone</span>
          <div className="devices-command-row">{destructive.map(button)}</div>
        </div>
      )}
      <p className="devices-note">Each command asks before it runs.</p>
      <FeedbackLine feedback={call.feedback} />
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
    </div>
  );
}
