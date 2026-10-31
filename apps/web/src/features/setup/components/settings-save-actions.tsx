import { Trans, useTranslation } from 'react-i18next';
import { errorMessage } from '@/shared/api/errors';
import { Button, ConfirmDialog } from '@/shared/ui';
import type { SettingsDraftState } from '../use-settings-draft';

/** What the draft amounts to, in one line: the refusal, the problem, the count, or the notice. */
function DraftStatus({ form }: { form: SettingsDraftState }) {
  const { t } = useTranslation('setup');
  if (form.save.isError) {
    return (
      <span className="text-negative">
        {t('save.failed', { error: errorMessage(form.save.error) })}
      </span>
    );
  }
  if (form.problem) return <span className="text-negative">{t(`problem.${form.problem}`)}</span>;
  if (form.dirty.length > 0) {
    return (
      <span>
        <Trans
          t={t}
          i18nKey="save.unsaved"
          count={form.dirty.length}
          values={{ keys: form.dirty.join(', ') }}
          components={{ keys: <span className="font-mono text-xs wrap-anywhere" /> }}
        />
      </span>
    );
  }
  return (
    <span>{form.savedCount === null ? null : t('save.saved', { count: form.savedCount })}</span>
  );
}

/**
 * The page header's Discard and Save changes, with the state of the draft beside them. Shown
 * only while there is something to say: an edit, a refusal or the last save.
 */
export function SettingsSaveActions({ form }: { form: SettingsDraftState }) {
  const { t } = useTranslation('setup');
  const dirty = form.dirty.length > 0;
  if (!dirty && form.savedCount === null && !form.save.isError) return null;
  return (
    <div
      className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 max-[900px]:justify-start"
      role="region"
      aria-label={t('save.region')}
    >
      <p className="max-w-[420px] min-w-0 text-sm text-muted-foreground" role="status">
        <DraftStatus form={form} />
      </p>
      {dirty && (
        <div className="flex gap-2">
          <Button onClick={form.discard} disabled={form.save.isPending}>
            {t('save.discard')}
          </Button>
          <Button
            variant="primary"
            onClick={form.submit}
            disabled={form.save.isPending || form.problem !== null}
          >
            {form.save.isPending ? t('save.saving') : t('save.submit')}
          </Button>
        </div>
      )}
    </div>
  );
}

/** "Turn off “Block firmware updates”?": a guard off lets the real cloud reach the device. */
export function GuardOffDialog({ form }: { form: SettingsDraftState }) {
  const { t } = useTranslation('setup');
  const guard = form.asking;
  return (
    <ConfirmDialog
      open={guard !== null}
      title={t('guardOff.title', { label: guard ? t(`toggle.${guard}.label`) : '' })}
      confirmLabel={t('guardOff.confirm')}
      onCancel={form.cancelAsk}
      onConfirm={form.confirmAsk}
    >
      {guard && <p>{t(`toggle.${guard}.offWarning`)}</p>}
      <p>{t('guardOff.note')}</p>
    </ConfirmDialog>
  );
}
