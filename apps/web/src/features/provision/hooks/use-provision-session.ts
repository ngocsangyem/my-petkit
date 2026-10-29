import { useCallback, useRef, useState } from 'react';
import type { BleDeviceLike } from '@/ble/gatt-types';
import {
  bluetoothErrorLogLine,
  bluetoothErrorText,
  deviceLabel,
  provisionDevice,
  refuseAccessory,
  REQUEST_DEVICE_OPTIONS,
  type ProvisionOutcome,
} from '@/ble/provision-device';
import { buildProvisionConfig, type ProvisionInput } from '@/ble/provisioning-payload';
import { useWatchForNewDevice } from './use-watch-for-new-device';

export interface LogLine {
  id: number;
  time: string;
  text: string;
}

/** One device picked from the browser's chooser this visit. */
export interface FoundDevice {
  id: string;
  name: string;
  device: BleDeviceLike;
}

const STATUS_BY_OUTCOME: Record<ProvisionOutcome, string> = {
  accessory: 'This model has no Wi-Fi.',
  'unknown-device': 'Unknown device.',
  provisioned: 'Provisioned. The device will restart and join Wi-Fi.',
  unanswered: 'Sent, but the device never answered.',
};

const sleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

function clockTime(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

/** Everything the page drives: the chooser, the send, the session log and status line. */
export function useProvisionSession() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<FoundDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ProvisionOutcome | null>(null);
  const nextId = useRef(0);

  const log = useCallback((text: string) => {
    const line = { id: nextId.current++, time: clockTime(), text };
    setLines(prev => [...prev, line]);
  }, []);
  const watch = useWatchForNewDevice({
    log,
    onConnected: () => {
      setStatus('Device connected. See the Devices page.');
    },
  });

  /** Open the browser's chooser; the picked device joins the list and is selected. */
  const choose = useCallback(async (): Promise<FoundDevice | null> => {
    setStatus('Requesting device…');
    const device = await navigator.bluetooth.requestDevice(REQUEST_DEVICE_OPTIONS);
    const entry = { id: device.id, name: deviceLabel(device), device };
    setFound(prev => [...prev.filter(d => d.id !== entry.id), entry]);
    setSelectedId(entry.id);
    log(`selected: ${entry.name}`);
    setStatus('');
    return entry;
  }, [log]);

  const fail = useCallback(
    (err: unknown) => {
      setStatus(`Error: ${bluetoothErrorText(err)}`);
      log(bluetoothErrorLogLine(err));
    },
    [log],
  );

  const findDevice = useCallback(async () => {
    setBusy(true);
    try {
      const entry = await choose();
      if (entry && refuseAccessory(entry.device, log)) setStatus(STATUS_BY_OUTCOME.accessory);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }, [choose, fail, log]);

  const send = useCallback(
    async (input: ProvisionInput) => {
      if (!input.ssid || !input.pwd) {
        setStatus('The Wi-Fi name and password are both required.');
        return;
      }
      setBusy(true);
      setLines([]);
      setOutcome(null);
      watch.stop();
      try {
        // With nothing picked yet, Send opens the chooser itself, as one click.
        const picked = found.find(d => d.id === selectedId);
        if (picked) log(`selected: ${picked.name}`);
        const entry = picked ?? (await choose());
        if (!entry) return;
        const result = await provisionDevice(entry.device, buildProvisionConfig(input), {
          log,
          sleep,
          now: () => Date.now(),
          onPhase: phase => {
            setStatus(phase === 'connecting' ? 'Connecting…' : 'Sending…');
          },
        });
        setOutcome(result);
        setStatus(STATUS_BY_OUTCOME[result]);
        if (result === 'provisioned' || result === 'unanswered') void watch.start();
      } catch (err) {
        fail(err);
      } finally {
        setBusy(false);
      }
    },
    [choose, fail, found, log, selectedId, watch],
  );

  return { lines, status, busy, found, selectedId, setSelectedId, outcome, findDevice, send };
}
