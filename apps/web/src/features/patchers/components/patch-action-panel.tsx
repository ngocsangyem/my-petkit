import { useEffect, useId, useRef, useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { formatBytes } from '@/shared/format/format';
import { Button, Card, Panel, RiskNotice } from '@/shared/ui';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/shadcn/field';
import { Textarea } from '@/shared/ui/shadcn/textarea';
import { useRunPatcher, type PatcherEntry } from '../api';
import type { PatcherProgress } from '../hooks/use-patcher-progress';
import { applyBlocker, normaliseDescription, PATCH_RISK } from '../patcher-model';

interface PatchActionPanelProps {
  deviceId: number;
  deviceName: string;
  /** Model codename and firmware, for the device line. */
  deviceType: string;
  deviceFirmware: string;
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
  deviceType,
  deviceFirmware,
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
    <Card as="section" aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 id={titleId} className="text-xl">
          {applying
            ? `Apply ${patcher.name} to ${deviceName}?`
            : `Remove ${patcher.name} from ${deviceName}?`}
        </h2>
        <p className="text-md whitespace-pre-line text-lede">
          {normaliseDescription(patcher.description)}
        </p>
      </div>
      <div className="flex flex-col">
        <span>{deviceName}</span>
        <span className="text-xs text-muted-foreground">
          {deviceType.toUpperCase()}
          {deviceFirmware && (
            <>
              {' · '}
              <span className="font-mono">{deviceFirmware}</span>
            </>
          )}
          {' · '}
          <span className="font-mono">#{deviceId}</span>
        </span>
      </div>
      <RiskNotice>{PATCH_RISK}</RiskNotice>
      <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-1.5 min-[901px]:grid-cols-[160px_minmax(0,1fr)] [&_dt]:text-muted-foreground">
        <dt>How to undo</dt>
        <dd className="m-0">
          {applying
            ? 'Remove undoes it: the files are deleted from /system and the device reboots without the patch.'
            : 'The device reboots without this patch. Other patches stay active; with none left it boots stock firmware.'}
        </dd>
        {applying && (
          <>
            <dt>Space on the box</dt>
            <dd className="m-0">
              Needs about {formatBytes(patcher.needs_bytes)} free. Free space is checked on the
              device before anything is written; the exact need is measured then and is usually
              smaller.
            </dd>
          </>
        )}
      </dl>

      {needsKey && (
        <Field className="gap-1.5">
          <FieldLabel htmlFor={keyId} className="ml-1 text-sm font-normal text-muted-foreground">
            SSH public key
          </FieldLabel>
          <Textarea
            id={keyId}
            className="field-sizing-fixed resize-y rounded-md border-0 bg-raised px-3.5 py-2.5 font-mono text-xs leading-normal"
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

      {blocker && <p className="text-sm text-warning">{blocker}</p>}

      {lines.length > 0 && (
        <Panel padding="none">
          <pre
            ref={log}
            className="m-0 max-h-50 overflow-auto px-3.5 py-2.5 font-mono text-xs leading-normal wrap-anywhere whitespace-pre-wrap"
            role="log"
            aria-label="Progress"
            tabIndex={0}
          >
            {lines.join('\n')}
          </pre>
        </Panel>
      )}
      {run.isSuccess && (
        <p role="status" className="text-sm text-muted-foreground">
          Accepted. Progress comes from the server over the live connection; a run takes minutes.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="danger-final"
          size="large"
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
      <p className="text-xs text-muted-foreground">
        Asks for your password, then shows progress here step by step.
      </p>
      {run.isError && (
        <p role="alert" className="text-sm text-negative">
          {applying ? 'Not applied' : 'Not removed'}: {errorMessage(run.error)}
        </p>
      )}
    </Card>
  );
}
