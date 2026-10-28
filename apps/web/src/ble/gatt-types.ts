// The slice of Web Bluetooth the provisioning sessions use, as structural
// types: the browser's objects satisfy them, and the tests drive the sessions
// with a scripted fake device instead of a radio.

/** Bytes a characteristic accepts. */
export type WritableBytes = Uint8Array<ArrayBuffer>;

export interface GattCharacteristicProperties {
  readonly notify?: boolean;
  readonly indicate?: boolean;
  readonly write?: boolean;
  readonly writeWithoutResponse?: boolean;
}

export interface GattCharacteristicLike {
  readonly uuid: string;
  readonly properties?: GattCharacteristicProperties;
  /** The latest notified value, set before `characteristicvaluechanged` fires. */
  readonly value?: DataView | null;
  addEventListener(type: 'characteristicvaluechanged', listener: () => void): void;
  startNotifications(): Promise<unknown>;
  writeValueWithResponse?: (value: WritableBytes) => Promise<void>;
  writeValue(value: WritableBytes): Promise<void>;
}

export interface DisconnectSource {
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
}

export interface GattServiceLike {
  readonly uuid: string;
  readonly device?: DisconnectSource;
  getCharacteristic(uuid: string): Promise<GattCharacteristicLike>;
  getCharacteristics(): Promise<GattCharacteristicLike[]>;
}

export interface GattServerLike {
  getPrimaryService(uuid: string): Promise<GattServiceLike>;
  getPrimaryServices(): Promise<readonly { readonly uuid: string }[]>;
  disconnect(): void;
}

export interface BleDeviceLike {
  readonly id: string;
  readonly name?: string | undefined;
  readonly gatt?: { connect(): Promise<GattServerLike> } | undefined;
}

/** What a session needs from its surroundings; injected so tests run without real time. */
export interface SessionDeps {
  /** One line for the session log. */
  log: (line: string) => void;
  sleep: (ms: number) => Promise<void>;
  /** Milliseconds, as `Date.now()`. */
  now: () => number;
}

/** Writes with response when the browser offers it; never without response. */
export function writerFor(char: GattCharacteristicLike): (value: WritableBytes) => Promise<void> {
  const withResponse = char.writeValueWithResponse;
  return withResponse ? value => withResponse.call(char, value) : value => char.writeValue(value);
}
