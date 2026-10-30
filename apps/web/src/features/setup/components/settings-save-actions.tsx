import { errorMessage } from '@/shared/api/errors';
import { Button, ConfirmDialog } from '@/shared/ui';
import type { SettingsDraftState } from '../use-settings-draft';

/** What the draft amounts to, in one line: the refusal, the problem, the count, or the notice. */
function DraftStatus({ form }: { form: SettingsDraftState }) {
  if (form.save.isError) {
    return (
      <span className="text-negative">Nothing was saved: {errorMessage(form.save.error)}</span>
    );
  }
  if (form.problem) return <span className="text-negative">{form.problem}</span>;
  if (form.dirty.length > 0) {
    return (
      <span>
        {form.dirty.length === 1 ? '1 unsaved change' : `${form.dirty.length} unsaved changes`}:{' '}
        <span className="font-mono text-xs wrap-anywhere">{form.dirty.join(', ')}</span>. Saving
        asks for your password.
      </span>
    );
  }
  return <span>{form.notice}</span>;
}

/**
 * The page header's Discard and Save changes, with the state of the draft beside them. Shown
 * only while there is something to say: an edit, a refusal or the last save.
 */
export function SettingsSaveActions({ form }: { form: SettingsDraftState }) {
  const dirty = form.dirty.length > 0;
  if (!dirty && !form.notice && !form.save.isError) return null;
  return (
    <div
      className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 max-[900px]:justify-start"
      role="region"
      aria-label="Unsaved settings"
    >
      <p className="max-w-[420px] min-w-0 text-sm text-muted-foreground" role="status">
        <DraftStatus form={form} />
      </p>
      {dirty && (
        <div className="flex gap-2">
          <Button onClick={form.discard} disabled={form.save.isPending}>
            Discard
          </Button>
          <Button
            variant="primary"
            onClick={form.submit}
            disabled={form.save.isPending || form.problem !== null}
          >
            {form.save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      )}
    </div>
  );
}

/** "Turn off “Block firmware updates”?": a guard off lets the real cloud reach the device. */
export function GuardOffDialog({ form }: { form: SettingsDraftState }) {
  return (
    <ConfirmDialog
      open={form.asking !== null}
      title={`Turn off “${form.asking?.label ?? ''}”?`}
      confirmLabel="Turn off"
      onCancel={form.cancelAsk}
      onConfirm={form.confirmAsk}
    >
      <p>{form.asking?.offWarning}</p>
      <p>Nothing changes until you save.</p>
    </ConfirmDialog>
  );
}
