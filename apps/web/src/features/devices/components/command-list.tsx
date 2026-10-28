import type { QueryKey } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Button, ConfirmDialog } from '@/shared/ui';
import { useDeviceCall } from '../hooks/use-device-call';
import { FeedbackLine } from './panel-parts';

/** One command button. */
export interface Command {
  key: string;
  name: string;
  /** Destructive commands are red text and always sort last. */
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
 * Device commands (R2): secondary buttons, destructive ones last, and each asks
 * before it runs. The confirm sheet's title is a question and its body says
 * what moves and how it gets there.
 */
export function CommandList({ commands, target, route, refresh, extra }: CommandListProps) {
  const call = useDeviceCall();
  const [asking, setAsking] = useState<Command | null>(null);
  // Stable: the server already sends destructive last, and this keeps it so.
  const ordered = [...commands].sort((a, b) => Number(a.destructive) - Number(b.destructive));

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
        {ordered.map(cmd => (
          <Button
            key={cmd.key}
            variant={cmd.destructive ? 'destructive' : 'secondary'}
            disabled={call.busy}
            onClick={() => {
              setAsking(cmd);
            }}
          >
            {cmd.name}
          </Button>
        ))}
      </div>
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
