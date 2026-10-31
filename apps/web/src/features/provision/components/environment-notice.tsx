import { Trans, useTranslation } from 'react-i18next';
import type { EnvironmentBlock } from '@/ble/provisioning-payload';
import { i18n } from '@/i18n';
import { RiskNotice } from '@/shared/ui';

const HOSTED = 'https://petkit.2442.pl';

/** The sentence on the disabled controls, from the same source as the notice. */
export function environmentTooltip(block: EnvironmentBlock): string | undefined {
  if (block === 'insecure-context') return i18n.t('provision:environment.insecureTooltip');
  if (block === 'no-web-bluetooth') return i18n.t('provision:environment.noBluetoothTooltip');
  return undefined;
}

/** Why the form is switched off: an insecure page first, then a browser without Web Bluetooth. */
export function EnvironmentNotice({ block }: { block: EnvironmentBlock }) {
  const { t } = useTranslation('provision');
  if (block === 'insecure-context') {
    return (
      <RiskNotice>
        <Trans
          t={t}
          i18nKey="environment.insecure"
          values={{ url: HOSTED }}
          components={{
            // Trans fills the link with the URL as its text.
            hosted: (
              <a href={HOSTED} target="_blank" rel="noopener noreferrer" className="font-mono" />
            ),
          }}
        />
      </RiskNotice>
    );
  }
  if (block === 'no-web-bluetooth') {
    return <RiskNotice>{t('environment.noBluetooth')}</RiskNotice>;
  }
  return null;
}
