import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, OverlayTitleRow } from '@/shared/ui';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/shadcn/dialog';
import { SoundsBody } from './sounds-section';

/**
 * The "Sounds" row of a device's settings, and the dialog it opens. The list is read only while
 * the dialog is open.
 */
export function SoundsRow({ deviceId, deviceNoun }: { deviceId: number; deviceNoun: string }) {
  const { t } = useTranslation('devices');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="flex min-h-13 w-full items-center gap-3 border-0 border-t border-rule bg-transparent p-0 text-left text-foreground"
        onClick={() => {
          setOpen(true);
        }}
      >
        <span className="flex-1">{t('sounds.title')}</span>
        <span className="text-muted-foreground">{t('sounds.custom')}</span>
        <Icon name="forward" size={16} className="text-muted-foreground" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100vh-32px)] w-[calc(100%-32px)] max-w-[520px] gap-4 overflow-y-auto sm:max-w-[520px]"
        >
          <OverlayTitleRow
            onClose={() => {
              setOpen(false);
            }}
          >
            <DialogTitle>{t('sounds.title')}</DialogTitle>
          </OverlayTitleRow>
          <DialogDescription className="-mt-2">
            {t('sounds.description', { noun: deviceNoun })}
          </DialogDescription>
          {open && <SoundsBody deviceId={deviceId} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
