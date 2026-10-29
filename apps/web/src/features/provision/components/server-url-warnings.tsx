import { provisionUrlWarning, type UrlWarning } from '@/ble/provisioning-payload';

const TEXT: Record<UrlWarning, string> = {
  'mdns-host':
    'This address uses a .local mDNS host, which most PetKit devices cannot resolve. Use the server’s IP instead, for example http://<server-ip>/6/.',
  'not-port-80':
    'ESP32 devices such as T4 and D4 need the server on port 80. Provisioning them will fail with this address.',
};

/** Advisory notes on the server address. They never switch the form off. */
export function ServerUrlWarnings({ value }: { value: string }) {
  const warnings = provisionUrlWarning(value);
  if (warnings.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-warning" aria-live="polite">
      {warnings.map(w => (
        <li key={w}>{TEXT[w]}</li>
      ))}
    </ul>
  );
}
