import { useEffect, useId, useRef, useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { formatBytes } from '@/shared/format/format';
import { Button } from '@/shared/ui';
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
    <section className="patchers-panel" aria-labelledby={titleId}>
      <h2 id={titleId} className="patchers-panel__title">
        {applying
          ? `Apply ${patcher.name} to ${deviceName}?`
          : `Remove ${patcher.name} from ${deviceName}?`}
      </h2>
      <p className="patchers-panel__description">{normaliseDescription(patcher.description)}</p>

      {needsKey && (
        <div className="patchers-field">
          <label htmlFor={keyId} className="patchers-field__label">
            SSH public key
          </label>
          <textarea
            id={keyId}
            className="ui-control patchers-pubkey"
            rows={3}
            placeholder="ssh-ed25519 AAAA… you@laptop"
            aria-describedby={keyHintId}
            value={pubkey}
            onChange={e => {
              setPubkey(e.target.value);
            }}
          />
          <span id={keyHintId} className="patchers-muted">
            Root SSH on port 22 accepts this key only: ssh-ed25519, ssh-rsa or ecdsa-sha2.
          </span>
        </div>
      )}

      {applying && (
        <p className="patchers-muted">
          Needs about {formatBytes(patcher.needs_bytes)} free on the device. Free space is checked
          on the device before anything is written; the exact need is measured then and is usually
          smaller.
        </p>
      )}
      <p className="patchers-muted">
        {applying
          ? 'Remove undoes it: the files are deleted from /system and the device reboots without the patch.'
          : 'The device reboots without this patch. Other patches stay active; with none left it boots stock firmware.'}
      </p>
      {blocker && <p className="patchers-warning">{blocker}</p>}

      {lines.length > 0 && (
        <pre ref={log} className="patchers-log" role="log" aria-label="Progress" tabIndex={0}>
          {lines.join('\n')}
        </pre>
      )}
      {run.isSuccess && (
        <p role="status" className="patchers-muted">
          Accepted. Progress comes from the server over the live connection; a run takes minutes.
        </p>
      )}

      <div className="patchers-panel__actions">
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
        <p role="alert" className="patchers-error">
          {applying ? 'Not applied' : 'Not removed'}: {errorMessage(run.error)}
        </p>
      )}
    </section>
  );
}
