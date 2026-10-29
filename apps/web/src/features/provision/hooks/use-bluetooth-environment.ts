import { useMemo } from 'react';
import { environmentBlock, type EnvironmentBlock } from '@/ble/provisioning-payload';

/** Whether this page can provision at all, and why not. Read once per mount. */
export function useBluetoothEnvironment(): EnvironmentBlock {
  return useMemo(() => {
    // Typed as always present, but a browser without Web Bluetooth (or any
    // browser on a plain-HTTP page) has no `navigator.bluetooth` at all.
    const bt = (navigator as Partial<Navigator>).bluetooth;
    const hasBluetooth = typeof bt?.requestDevice === 'function';
    return environmentBlock(hasBluetooth, window.isSecureContext);
  }, []);
}
