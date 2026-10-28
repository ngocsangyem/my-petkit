// The two session state machines against a scripted device, in virtual time.

import { BLUFI_E2P, BLUFI_P2E, BLUFI_SERVICE, blufiFrames } from './blufi-protocol';
import { provisionBlufi } from './blufi-provisioning-session';
import { FakeCharacteristic, FakeService, virtualDeps } from './fake-gatt-device';
import type { BleDeviceLike, GattServerLike } from './gatt-types';
import {
  DELAY_ACK_TO_FIRST_POLL,
  DELAY_CONFIRM_TO_DONE,
  DELAY_IDENT_TO_CREDENTIALS,
  DELAY_JOINED_TO_CONFIRM,
  provisionIngenic,
} from './ingenic-provisioning-session';
import { bluetoothErrorText, provisionDevice } from './provision-device';
import { buildProvisionConfig } from './provisioning-payload';
import { BLE_RX, BLE_SERVICE, BLE_TX, pkFrame, pkParse } from './provisioning-protocol';

const cfg = buildProvisionConfig({
  ssid: 'Home',
  pwd: 'secret',
  server: 'http://192.168.1.20/6/',
  timezone: 7,
  zoneName: 'Asia/Saigon',
  browserLanguage: 'vi-VN',
});

/** An Ingenic device answering each key from a script of payloads per key. */
function ingenicDevice(script: Record<number, object[]>) {
  const tx = new FakeCharacteristic(BLE_TX, { notify: true });
  const rx = new FakeCharacteristic(BLE_RX, { write: true });
  const sent: number[] = [];
  rx.onWrite = bytes => {
    const key = pkParse(bytes)?.key;
    if (key === undefined) return;
    sent.push(key);
    const next = script[key]?.shift();
    if (next) tx.notify(pkFrame(0, { key, payload: next }));
  };
  return { service: new FakeService(BLE_SERVICE, [tx, rx]), sent, rx };
}

describe('Ingenic session', () => {
  it('identifies, sends credentials, confirms the join, then completes with key 101', async () => {
    const { service, sent, rx } = ingenicDevice({
      110: [{}],
      151: [{ state: 1 }],
      112: [{ state: 2 }, { state: 10 }, { state: 10 }],
    });
    const deps = virtualDeps();
    await expect(provisionIngenic(service, cfg, deps)).resolves.toBe(true);
    expect(sent).toEqual([110, 151, 112, 112, 112, 101]);
    expect(deps.sleeps).toContain(DELAY_IDENT_TO_CREDENTIALS);
    expect(deps.sleeps).toContain(DELAY_ACK_TO_FIRST_POLL);
    expect(deps.sleeps).toContain(DELAY_JOINED_TO_CONFIRM);
    expect(deps.sleeps).toContain(DELAY_CONFIRM_TO_DONE);
    expect(rx.writes.map(w => w[5])).toEqual([0, 1, 2, 3, 4, 5]);
    expect(pkParse(rx.writes[1]!)?.payload).toEqual(cfg.payload);
  });

  it('retries key 110 once, then reports a device that never answered', async () => {
    const { service, sent } = ingenicDevice({});
    const deps = virtualDeps();
    await expect(provisionIngenic(service, cfg, deps)).resolves.toBe(false);
    expect(sent).toEqual([110, 110]);
    expect(deps.lines).toContain(
      'the device never answered — make sure it is still in pairing mode.',
    );
  });

  it('stops on a failure state and names it', async () => {
    const { service } = ingenicDevice({ 110: [{}], 151: [{ state: 1 }], 112: [{ state: 4 }] });
    const deps = virtualDeps();
    await expect(provisionIngenic(service, cfg, deps)).resolves.toBe(false);
    expect(deps.lines).toContain('the device gave up: that Wi-Fi network was not found');
  });

  it('keeps going through a wrong-password report, with a warning', async () => {
    const { service } = ingenicDevice({
      110: [{}],
      151: [{ state: 1 }],
      112: [{ state: 3, code: 2 }, { state: 7 }, { state: 7 }],
    });
    const deps = virtualDeps();
    await expect(provisionIngenic(service, cfg, deps)).resolves.toBe(true);
    expect(deps.lines.some(l => l.startsWith('warning: the device reported a wrong'))).toBe(true);
  });

  it('counts an accepted-but-silent device as provisioned, saying it may still join', async () => {
    const { service, sent } = ingenicDevice({ 110: [{}], 151: [{ state: 1 }] });
    const deps = virtualDeps();
    await expect(provisionIngenic(service, cfg, deps)).resolves.toBe(true);
    expect(sent.filter(k => k === 112)).toHaveLength(25);
    expect(deps.lines.at(-1)).toContain('It may still get there on its own');
  });

  it('lists what it saw when neither write nor notify characteristic exists', async () => {
    const service = new FakeService(BLE_SERVICE, [new FakeCharacteristic('x')]);
    const deps = virtualDeps();
    await expect(provisionIngenic(service, cfg, deps)).resolves.toBe(false);
    expect(deps.lines[0]).toBe('could not find PetKit write/notify characteristics. Seen: x []');
  });
});

/** An ESP32 device: reassembles custom data and answers from a script per key. */
function blufiDevice(script: Record<number, object[]>) {
  const e2p = new FakeCharacteristic(BLUFI_E2P, { notify: true });
  const p2e = new FakeCharacteristic(BLUFI_P2E, { write: true });
  const sent: number[] = [];
  let pending: number[] = [];
  p2e.onWrite = frame => {
    const fragment = (frame[1]! & 0x10) !== 0;
    const data = Array.from(frame.slice(4, 4 + frame[3]!));
    pending.push(...(fragment ? data.slice(2) : data));
    if (fragment) return;
    const key = pkParse(new Uint8Array(pending))?.key;
    pending = [];
    if (key === undefined) return;
    sent.push(key);
    const next = script[key]?.shift();
    if (!next) return;
    const reply = new TextEncoder().encode(JSON.stringify({ key, payload: next }));
    for (const f of blufiFrames({ seq: 0 }, reply)) e2p.notify(f);
  };
  return { service: new FakeService(BLUFI_SERVICE, [e2p, p2e]), sent };
}

describe('BLUFI session', () => {
  it('asks for Wi-Fi details at state 6, then sends language and completion', async () => {
    const { service, sent } = blufiDevice({
      110: [{}],
      151: [{ state: 1 }],
      112: [{ state: 6 }],
      111: [{}],
      114: [{}],
    });
    // State 6 arrives on the first 112; the third join poll hears "connected to the server".
    const deps = virtualDeps();
    const tick = deps.sleep;
    let polls = 0;
    deps.sleep = async ms => {
      if (ms === 1000 && ++polls === 3) {
        const e2p = (await service.getCharacteristic(BLUFI_E2P)) as FakeCharacteristic;
        const reply = new TextEncoder().encode('{"key":112,"payload":{"state":7}}');
        for (const f of blufiFrames({ seq: 0 }, reply)) e2p.notify(f);
      }
      await tick(ms);
    };
    const run = provisionBlufi(service, cfg, deps);
    await expect(run).resolves.toBe(true);
    expect(sent).toEqual([110, 151, 112, 111, 112, 114, 101]);
  });

  it('times out on identity after one retry', async () => {
    const { service, sent } = blufiDevice({});
    const deps = virtualDeps();
    await expect(provisionBlufi(service, cfg, deps)).resolves.toBe(false);
    expect(sent).toEqual([110, 110]);
    expect(deps.lines.at(-1)).toBe('timed out waiting for the device identity.');
  });

  it('fails early when the credentials are refused', async () => {
    const { service } = blufiDevice({ 110: [{}], 151: [{ state: 5 }] });
    const deps = virtualDeps();
    await expect(provisionBlufi(service, cfg, deps)).resolves.toBe(false);
    expect(deps.lines.at(-1)).toBe(
      'the device refused the credentials: could not connect to the Wi-Fi',
    );
  });

  it('notices a disconnect and says so', async () => {
    const { service } = blufiDevice({});
    const deps = virtualDeps();
    const tick = deps.sleep;
    deps.sleep = async ms => {
      service.disconnect();
      await tick(ms);
    };
    await expect(provisionBlufi(service, cfg, deps)).resolves.toBe(false);
    expect(deps.lines.at(-1)).toBe('the device disconnected before identifying itself.');
    // No retry once the device is gone.
    expect(deps.lines.filter(l => l.startsWith('ESP32: key 110'))).toHaveLength(1);
  });
});

describe('provisionDevice', () => {
  const server = (services: Record<string, FakeService>) => {
    const s: GattServerLike & { disconnected: boolean } = {
      disconnected: false,
      getPrimaryService: uuid => {
        const svc = services[uuid];
        return svc ? Promise.resolve(svc) : Promise.reject(new DOMException('no', 'NotFoundError'));
      },
      getPrimaryServices: () => Promise.resolve(Object.values(services)),
      disconnect: () => {
        s.disconnected = true;
      },
    };
    return s;
  };
  const device = (name: string, gatt: GattServerLike): BleDeviceLike => ({
    id: 'abc',
    name,
    gatt: { connect: () => Promise.resolve(gatt) },
  });

  it('refuses an accessory without connecting', async () => {
    const deps = { ...virtualDeps(), onPhase: vi.fn() };
    const gatt = server({});
    await expect(provisionDevice(device('Petkit_K3_1', gatt), cfg, deps)).resolves.toBe(
      'accessory',
    );
    expect(deps.onPhase).not.toHaveBeenCalled();
  });

  it('names an unknown device by the services it showed, and disconnects', async () => {
    const deps = { ...virtualDeps(), onPhase: vi.fn() };
    const gatt = server({
      '0000180a-0000-1000-8000-00805f9b34fb': new FakeService(
        '0000180a-0000-1000-8000-00805f9b34fb',
        [],
      ),
    });
    await expect(provisionDevice(device('Petkit_Mini', gatt), cfg, deps)).resolves.toBe(
      'unknown-device',
    );
    expect(deps.lines.at(-1)).toContain('Services seen: 0000180a-');
    expect(gatt.disconnected).toBe(true);
  });

  it('prefers the Ingenic service and reports an unanswered write honestly', async () => {
    const deps = { ...virtualDeps(), onPhase: vi.fn() };
    const { service } = ingenicDevice({});
    const gatt = server({ [BLE_SERVICE]: service });
    await expect(provisionDevice(device('Petkit_T6', gatt), cfg, deps)).resolves.toBe('unanswered');
    expect(deps.lines[0]).toBe('protocol: PetKit (0xAAA0)');
    expect(deps.onPhase.mock.calls).toEqual([['connecting'], ['sending']]);
    expect(gatt.disconnected).toBe(true);
  });

  it('maps browser errors to sentences', () => {
    expect(bluetoothErrorText(new DOMException('x', 'NotFoundError'))).toContain('pairing mode');
    expect(bluetoothErrorText(new DOMException('x', 'SecurityError'))).toContain('HTTPS');
    expect(bluetoothErrorText(new DOMException('gone', 'NetworkError'))).toBe('NetworkError: gone');
  });
});
