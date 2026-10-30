import { useEffect, useId, useRef, useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { formatBytes } from '@/shared/format/format';
import { Button } from '@/shared/ui';
import { Card } from '@/shared/ui/shadcn/card';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/shadcn/field';
import { Textarea } from '@/shared/ui/shadcn/textarea';
import { useRunPatcher, type PatcherEntry } from '../api';
import type { PatcherProgress } from '../hooks/use-patcher-progress';
import { applyBlocker, normaliseDescription } from '../patcher-model';

interface PatchActionPanelProps {
  deviceId: number;
  deviceName: string;
  deviceIp: string;
  patcher: PatcherEntry;
  action: 'apply' | 'remove';
  lines: readonly string[];
  note: PatcherProgress['note'];
  onSwitch: (action: 'apply' | 'remove') => void;
  onClose: () => void;
}

/**
 * The step-up screen for one patch: what it does in full, the key it needs,
 * how to undo it, the red final action, and the run's live progress lines.
 */
export function PatchActionPanel({
  deviceId,
  deviceName,
  deviceIp,
  patcher,
  action,
  lines,
  note,
  onSwitch,
  onClose,
}: PatchActionPanelProps) {
  const titleId = useId();
  const keyId = useId();
  const keyHintId = useId();
  const [pubkey, setPubkey] = useState(patcher.ssh_pubkey ?? '');
  const run = useRunPatcher();
  const log = useRef<HTMLPreElement>(null);
  const applying = action === 'apply';
  const blocker = applying ? applyBlocker(patcher, deviceIp) : null;
  const needsKey = applying && patcher.needs_pubkey === true;
  const keyMissing = needsKey && !pubkey.trim();

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [lines]);

  function start() {
    run.reset();
    note(deviceId, patcher.id, applying ? 'Starting…' : 'Removing…', true);
    run.mutate(
      { deviceId, patcher: patcher.id, action, pubkey: needsKey ? pubkey.trim() : undefined },
      {
        onError: error => {
          note(deviceId, patcher.id, `ERROR: ${errorMessage(error)}`);
        },
      },
    );
  }

  return (
    <Card role="region" aria-labelledby={titleId} className="max-w-160 gap-3.5 px-5">
      <h2 id={titleId} className="text-lg font-semibold">
        {applying
          ? `Apply ${patcher.name} to ${deviceName}?`
          : `Remove ${patcher.name} from ${deviceName}?`}
      </h2>
      <p className="whitespace-pre-line">{normaliseDescription(patcher.description)}</p>

      {needsKey && (
        <Field className="gap-1.5">
          <FieldLabel htmlFor={keyId}>SSH public key</FieldLabel>
          <Textarea
            id={keyId}
            className="field-sizing-fixed resize-y px-2.5 py-2 font-mono text-xs leading-normal"
            rows={3}
            placeholder="ssh-ed25519 AAAA… you@laptop"
            aria-describedby={keyHintId}
            value={pubkey}
            onChange={e => {
              setPubkey(e.target.value);
            }}
          />
          <FieldDescription id={keyHintId}>
            Root SSH on port 22 accepts this key only: ssh-ed25519, ssh-rsa or ecdsa-sha2.
          </FieldDescription>
        </Field>
      )}

      {applying && (
        <p className="text-sm text-muted-foreground">
          Needs about {formatBytes(patcher.needs_bytes)} free on the device. Free space is checked
          on the device before anything is written; the exact need is measured then and is usually
          smaller.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {applying
          ? 'Remove undoes it: the files are deleted from /system and the device reboots without the patch.'
          : 'The device reboots without this patch. Other patches stay active; with none left it boots stock firmware.'}
      </p>
      {blocker && <p className="text-sm text-warning">{blocker}</p>}

      {lines.length > 0 && (
        <pre
          ref={log}
          className="m-0 max-h-50 overflow-auto rounded-lg bg-raised px-3 py-2.5 font-mono text-xs leading-normal wrap-anywhere whitespace-pre-wrap"
          role="log"
          aria-label="Progress"
          tabIndex={0}
        >
          {lines.join('\n')}
        </pre>
      )}
      {run.isSuccess && (
        <p role="status" className="text-sm text-muted-foreground">
          Accepted. Progress comes from the server over the live connection; a run takes minutes.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="danger-final"
          onClick={start}
          disabled={run.isPending || blocker !== null || keyMissing}
        >
          {applying ? `Apply ${patcher.name}` : `Remove ${patcher.name}`}
        </Button>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="text"
          onClick={() => {
            run.reset();
            onSwitch(applying ? 'remove' : 'apply');
          }}
        >
          {applying ? 'Remove instead' : 'Apply again'}
        </Button>
      </div>
      {run.isError && (
        <p role="alert" className="text-sm text-negative">
          {applying ? 'Not applied' : 'Not removed'}: {errorMessage(run.error)}
        </p>
      )}
    </Card>
  );
}
