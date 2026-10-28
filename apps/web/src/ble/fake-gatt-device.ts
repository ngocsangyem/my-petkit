// A scripted stand-in for a PetKit device's GATT side, for the session tests.
// Time is virtual: `sleep` advances a clock instead of waiting.

import type {
  GattCharacteristicLike,
  GattCharacteristicProperties,
  GattServiceLike,
  SessionDeps,
  WritableBytes,
} from './gatt-types';

export class FakeCharacteristic implements GattCharacteristicLike {
  value: DataView | null = null;
  readonly writes: Uint8Array[] = [];
  private readonly listeners: (() => void)[] = [];
  onWrite: (bytes: Uint8Array) => void = () => undefined;

  constructor(
    readonly uuid: string,
    readonly properties: GattCharacteristicProperties = {},
  ) {}

  addEventListener(_type: 'characteristicvaluechanged', listener: () => void): void {
    this.listeners.push(listener);
  }

  startNotifications(): Promise<unknown> {
    return Promise.resolve(this);
  }

  writeValueWithResponse = (value: WritableBytes): Promise<void> => {
    const copy = new Uint8Array(value);
    this.writes.push(copy);
    this.onWrite(copy);
    return Promise.resolve();
  };

  writeValue(value: WritableBytes): Promise<void> {
    return this.writeValueWithResponse(value);
  }

  /** Deliver one notification, as the browser does: set `value`, then fire. */
  notify(bytes: Uint8Array): void {
    this.value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (const l of this.listeners) l();
  }
}

export class FakeService implements GattServiceLike {
  private readonly disconnectListeners: (() => void)[] = [];
  readonly device = {
    addEventListener: (_type: 'gattserverdisconnected', l: () => void) => {
      this.disconnectListeners.push(l);
    },
  };

  constructor(
    readonly uuid: string,
    private readonly chars: FakeCharacteristic[],
  ) {}

  getCharacteristic(uuid: string): Promise<GattCharacteristicLike> {
    const c = this.chars.find(x => x.uuid === uuid);
    return c ? Promise.resolve(c) : Promise.reject(new DOMException('no such', 'NotFoundError'));
  }

  getCharacteristics(): Promise<GattCharacteristicLike[]> {
    return Promise.resolve(this.chars);
  }

  disconnect(): void {
    for (const l of this.disconnectListeners) l();
  }
}

/** Virtual-time session deps that record the log and every sleep. */
export function virtualDeps(): SessionDeps & { lines: string[]; sleeps: number[]; t: number } {
  const state = {
    lines: [] as string[],
    sleeps: [] as number[],
    t: 0,
    log: (line: string) => {
      state.lines.push(line);
    },
    sleep: async (ms: number) => {
      state.sleeps.push(ms);
      state.t += ms;
      await Promise.resolve();
    },
    now: () => state.t,
  };
  return state;
}
