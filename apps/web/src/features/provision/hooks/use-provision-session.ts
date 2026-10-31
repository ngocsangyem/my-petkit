import { useCallback, useRef, useState } from 'react';
import type { BleDeviceLike } from '@/ble/gatt-types';
import { currentLocale, i18n } from '@/i18n';
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

/** The status line's message, kept as a key so it follows a language change. */
type StatusKey =
  | 'accessory'
  | 'unknownDevice'
  | 'provisioned'
  | 'unanswered'
  | 'connected'
  | 'requesting'
  | 'error'
  | 'missingWifi'
  | 'connecting'
  | 'sending';

interface Status {
  key: StatusKey;
  /** The browser's Bluetooth error, for `error`. */
  error?: string;
}

const STATUS_BY_OUTCOME: Record<ProvisionOutcome, StatusKey> = {
  accessory: 'accessory',
  'unknown-device': 'unknownDevice',
  provisioned: 'provisioned',
  unanswered: 'unanswered',
};

function statusText(status: Status | null): string {
  if (!status) return '';
  return i18n.t(`provision:status.${status.key}`, { error: status.error ?? '' });
}

const sleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

function clockTime(): string {
  return new Date().toLocaleTimeString(currentLocale(), { hour12: false });
}

/**
 * Everything the page drives: the chooser, the send, the session log and status line. The
 * session log is a protocol trace, like the Bluetooth lines it interleaves with, and stays English.
 */
export function useProvisionSession() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
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
      setStatus({ key: 'connected' });
    },
  });

  /** Open the browser's chooser; the picked device joins the list and is selected. */
  const choose = useCallback(async (): Promise<FoundDevice | null> => {
    setStatus({ key: 'requesting' });
    const device = await navigator.bluetooth.requestDevice(REQUEST_DEVICE_OPTIONS);
    const entry = { id: device.id, name: deviceLabel(device), device };
    setFound(prev => [...prev.filter(d => d.id !== entry.id), entry]);
    setSelectedId(entry.id);
    log(`selected: ${entry.name}`);
    setStatus(null);
    return entry;
  }, [log]);

  const fail = useCallback(
    (err: unknown) => {
      setStatus({ key: 'error', error: bluetoothErrorText(err) });
      log(bluetoothErrorLogLine(err));
    },
    [log],
  );

  const findDevice = useCallback(async () => {
    setBusy(true);
    try {
      const entry = await choose();
      if (entry && refuseAccessory(entry.device, log))
        setStatus({ key: STATUS_BY_OUTCOME.accessory });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }, [choose, fail, log]);

  const send = useCallback(
    async (input: ProvisionInput) => {
      if (!input.ssid || !input.pwd) {
        setStatus({ key: 'missingWifi' });
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
            setStatus({ key: phase === 'connecting' ? 'connecting' : 'sending' });
          },
        });
        setOutcome(result);
        setStatus({ key: STATUS_BY_OUTCOME[result] });
        if (result === 'provisioned' || result === 'unanswered') void watch.start();
      } catch (err) {
        fail(err);
      } finally {
        setBusy(false);
      }
    },
    [choose, fail, found, log, selectedId, watch],
  );

  return {
    lines,
    // Translated at render: the page re-renders on a language change.
    status: statusText(status),
    busy,
    found,
    selectedId,
    setSelectedId,
    outcome,
    findDevice,
    send,
  };
}
