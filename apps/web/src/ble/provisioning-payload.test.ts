import { blufiFrames } from './blufi-protocol';
import {
  buildProvisionConfig,
  detectedOffsetHours,
  environmentBlock,
  isBleAccessory,
  provisionUrlWarning,
  timezoneOptions,
  utcOffsetLabel,
} from './provisioning-payload';

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

describe('server URL warnings', () => {
  it('warns when the API URL is not on port 80, which ESP32 devices require', () => {
    expect(provisionUrlWarning('http://192.168.50.29/6/')).toEqual([]);
    expect(provisionUrlWarning('http://192.168.50.29:8080/6/')).toContain('not-port-80');
    expect(provisionUrlWarning('https://ha.example/6/')).toContain('not-port-80');
  });

  it('warns about a .local mDNS host and stays quiet on a half-typed URL', () => {
    expect(provisionUrlWarning('http://homeassistant.local/6/')).toEqual(['mdns-host']);
    expect(provisionUrlWarning('http://homeassistant.local:8099/6/')).toEqual([
      'mdns-host',
      'not-port-80',
    ]);
    expect(provisionUrlWarning('http://192.168.')).toEqual([]);
    expect(provisionUrlWarning('')).toEqual([]);
  });
});

describe('environment gate', () => {
  it('blames the insecure page before the browser, because HTTP hides Web Bluetooth', () => {
    expect(environmentBlock(false, false)).toBe('insecure-context');
    expect(environmentBlock(true, false)).toBe('insecure-context');
    expect(environmentBlock(false, true)).toBe('no-web-bluetooth');
    expect(environmentBlock(true, true)).toBeNull();
  });
});

describe('accessories', () => {
  it('refuses a Bluetooth-only accessory by its advertised name', () => {
    for (const name of [
      'Petkit_W5_1',
      'Petkit_W4X',
      'Petkit_CTW2',
      'Petkit_CTW3',
      'Petkit_K2',
      'Petkit_K3_abc',
    ]) {
      expect(isBleAccessory(name)).toBe(true);
    }
    expect(isBleAccessory('Petkit_T6_8F2A')).toBe(false);
    expect(isBleAccessory('Petkit_D4SH')).toBe(false);
  });
});

describe('time zone picker', () => {
  it('offers UTC-12:00 to UTC+14:00 in quarter hours', () => {
    const opts = timezoneOptions();
    expect(opts).toHaveLength(105);
    expect(opts[0]).toEqual({ hours: -12, label: 'UTC-12:00' });
    expect(opts.at(-1)).toEqual({ hours: 14, label: 'UTC+14:00' });
    expect(utcOffsetLabel(5.75)).toBe('UTC+05:45');
    expect(utcOffsetLabel(-3.5)).toBe('UTC-03:30');
    expect(utcOffsetLabel(0)).toBe('UTC+00:00');
  });

  it('turns minutes west into hours east', () => {
    expect(detectedOffsetHours(-420)).toBe(7);
    expect(detectedOffsetHours(180)).toBe(-3);
  });
});

describe('key 151 payload', () => {
  it('is the app payload field for field, with the offset as a string and a zone name as locale', () => {
    const cfg = buildProvisionConfig({
      ssid: 'Home',
      pwd: 'secret',
      server: 'http://192.168.1.20/6/',
      timezone: 5.75,
      zoneName: 'Asia/Kathmandu',
      browserLanguage: 'en-US',
    });
    expect(cfg.language).toBe('en_US');
    expect(JSON.stringify({ key: 151, payload: cfg.payload })).toBe(
      '{"key":151,"payload":{"ssid":"Home","pwd":"secret","hide":1,"locale":"Asia/Kathmandu",' +
        '"timezone":"5.8","apiServers":["http://192.168.1.20/6/"],' +
        '"ipServers":["http://192.168.1.20/6/"]}}',
    );
  });

  it('defaults the language when the browser reports none', () => {
    const cfg = buildProvisionConfig({
      ssid: 'a',
      pwd: 'b',
      server: '',
      timezone: 0,
      zoneName: '',
      browserLanguage: '',
    });
    expect(cfg.language).toBe('en_US');
    expect(cfg.payload.timezone).toBe('0.0');
  });
});

describe('BLUFI custom-data framing', () => {
  it('sends twelve bytes or fewer as one unfragmented frame', () => {
    const ctr = { seq: 0 };
    const frames = blufiFrames(ctr, new TextEncoder().encode('{"key":110}'));
    expect(frames.map(hex)).toEqual(['4D 00 00 0B 7B 22 6B 65 79 22 3A 31 31 30 7D']);
    expect(ctr.seq).toBe(1);
  });

  it('splits into 12-byte chunks, each non-final one prefixed with what remains', () => {
    const ctr = { seq: 0 };
    const frames = blufiFrames(ctr, new TextEncoder().encode('0123456789abcdefghijklmn'));
    expect(frames.map(hex)).toEqual([
      '4D 10 00 0E 18 00 30 31 32 33 34 35 36 37 38 39 61 62',
      '4D 00 01 0C 63 64 65 66 67 68 69 6A 6B 6C 6D 6E',
    ]);
    expect(ctr.seq).toBe(2);
  });

  it('counts remaining length per chunk, not the whole message', () => {
    const frames = blufiFrames({ seq: 7 }, new Uint8Array(30));
    expect(frames).toHaveLength(3);
    expect([frames[0]![4], frames[1]![4]]).toEqual([30, 18]);
    expect(frames.map(f => f[2])).toEqual([7, 8, 9]);
    expect(frames[2]![1]).toBe(0);
  });
});
