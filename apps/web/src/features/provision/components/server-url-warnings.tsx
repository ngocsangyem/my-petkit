import { useTranslation } from 'react-i18next';
import { provisionUrlWarning, type UrlWarning } from '@/ble/provisioning-payload';

const KEY = {
  'mdns-host': 'warning.mdnsHost',
  'not-port-80': 'warning.notPort80',
} as const satisfies Record<UrlWarning, string>;

/** Advisory notes on the server address. They never switch the form off. */
export function ServerUrlWarnings({ value }: { value: string }) {
  const { t } = useTranslation('provision');
  const warnings = provisionUrlWarning(value);
  if (warnings.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-warning" aria-live="polite">
      {warnings.map(w => (
        <li key={w}>{t(KEY[w])}</li>
      ))}
    </ul>
  );
}
