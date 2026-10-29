import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api/client';

export const provisionKeys = {
  info: ['provision', 'info'] as const,
};

/** Server facts; the provisioning form reads `api_url`, the address devices are given. */
export function useServerInfo() {
  return useQuery({
    queryKey: provisionKeys.info,
    queryFn: () => unwrap(api.GET('/api/info')),
  });
}

/** The current device list, read directly while watching for a new device to appear. */
export function fetchDeviceList() {
  return unwrap(api.GET('/api/devices'));
}
