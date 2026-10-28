import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FakeCharacteristic, FakeService } from '@/ble/fake-gatt-device';
import type { GattServerLike, GattServiceLike } from '@/ble/gatt-types';
import { BLE_RX, BLE_SERVICE, BLE_TX, pkFrame, pkParse } from '@/ble/provisioning-protocol';
import { mockApi } from '@/test/mock-api';
import { renderWithProviders } from '@/test/render';
import { ProvisionPage } from './provision-page';
import { serverInfoFixture } from './provision-fixtures';

function setEnvironment({ secure, bluetooth }: { secure: boolean; bluetooth: unknown }) {
  Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true });
  Object.defineProperty(navigator, 'bluetooth', { value: bluetooth, configurable: true });
}

function gattServer(services: Record<string, GattServiceLike>): GattServerLike {
  return {
    getPrimaryService: uuid => {
      const s = services[uuid];
      return s ? Promise.resolve(s) : Promise.reject(new DOMException('no', 'NotFoundError'));
    },
    getPrimaryServices: () => Promise.resolve(Object.values(services)),
    disconnect: () => undefined,
  };
}

function bluetoothWith(name: string, services: Record<string, GattServiceLike> = {}) {
  const requestDevice = vi.fn(() =>
    Promise.resolve({
      id: `id-${name}`,
      name,
      gatt: { connect: () => Promise.resolve(gattServer(services)) },
    }),
  );
  return { requestDevice };
}

const deviceSummary = {
  id: 42,
  type: 't6',
  name: 'Litter box',
  sn: 'SN1',
  mac: 'aa:bb',
  firmware: '1.2.86',
  online: true,
  mqtt_connected: false,
  is_camera: true,
  is_feeder: false,
  supports_ai: true,
};

afterEach(() => {
  setEnvironment({ secure: true, bluetooth: undefined });
});

describe('ProvisionPage', () => {
  it('blames the plain-HTTP page, not the browser, and switches the form off', async () => {
    setEnvironment({ secure: false, bluetooth: undefined });
    mockApi({ 'GET /api/info': { body: serverInfoFixture('http://192.168.1.20/6/') } });
    renderWithProviders(<ProvisionPage />);
    expect(screen.getByText(/only works on a secure page/)).toBeInTheDocument();
    expect(screen.queryByText(/has no Web Bluetooth/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://petkit.2442.pl' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    const send = screen.getByRole('button', { name: 'Send to device' });
    expect(send).toBeDisabled();
    expect(send).toHaveAttribute('title', expect.stringContaining('plain HTTP'));
    expect(screen.getByRole('button', { name: 'Find device' })).toBeDisabled();
    expect(screen.getByLabelText(/Wi-Fi name/)).toBeDisabled();
    expect(await screen.findByDisplayValue('http://192.168.1.20/6/')).toBeDisabled();
  });

  it('says the browser lacks Web Bluetooth on a secure page without it', () => {
    setEnvironment({ secure: true, bluetooth: undefined });
    mockApi({ 'GET /api/info': { body: serverInfoFixture(null) } });
    renderWithProviders(<ProvisionPage />);
    expect(screen.getByText(/This browser has no Web Bluetooth/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to device' })).toBeDisabled();
  });

  it('prefills the server address and warns, without blocking, when it is not on port 80', async () => {
    setEnvironment({ secure: true, bluetooth: bluetoothWith('Petkit_T6') });
    mockApi({ 'GET /api/info': { body: serverInfoFixture('http://192.168.1.20:8099/6/') } });
    renderWithProviders(<ProvisionPage />);
    const field = await screen.findByDisplayValue('http://192.168.1.20:8099/6/');
    expect(screen.getByText(/need the server on port 80/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to device' })).toBeEnabled();
    await userEvent.clear(field);
    await userEvent.type(field, 'http://homeassistant.local/6/');
    expect(screen.queryByText(/need the server on port 80/)).not.toBeInTheDocument();
    expect(screen.getByText(/\.local mDNS host/)).toBeInTheDocument();
  });

  it('shows a retryable error when the server address cannot be read', async () => {
    setEnvironment({ secure: true, bluetooth: bluetoothWith('Petkit_T6') });
    let calls = 0;
    mockApi({
      'GET /api/info': () =>
        ++calls === 1
          ? { status: 500, body: { error: { code: 'internal', message: 'Boom.' } } }
          : { body: serverInfoFixture('http://10.0.0.2/6/') },
    });
    renderWithProviders(<ProvisionPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByDisplayValue('http://10.0.0.2/6/')).toBeInTheDocument();
  });

  it('requires the Wi-Fi name and password before opening the chooser', async () => {
    const bt = bluetoothWith('Petkit_T6');
    setEnvironment({ secure: true, bluetooth: bt });
    mockApi({ 'GET /api/info': { body: serverInfoFixture('http://10.0.0.2/6/') } });
    renderWithProviders(<ProvisionPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Send to device' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Wi-Fi name and password are both required',
    );
    expect(bt.requestDevice).not.toHaveBeenCalled();
  });

  it('refuses a Bluetooth-only accessory picked with Find device', async () => {
    setEnvironment({ secure: true, bluetooth: bluetoothWith('Petkit_K3_01') });
    mockApi({ 'GET /api/info': { body: serverInfoFixture('http://10.0.0.2/6/') } });
    renderWithProviders(<ProvisionPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Find device' }));
    expect(await screen.findByRole('radio', { name: /Petkit_K3_01/ })).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('This model has no Wi-Fi.');
    expect(screen.getByRole('log')).toHaveTextContent('is a Bluetooth-only accessory');
  });

  it('reports a cancelled chooser in words', async () => {
    const requestDevice = vi.fn(() =>
      Promise.reject(new DOMException('User cancelled', 'NotFoundError')),
    );
    setEnvironment({ secure: true, bluetooth: { requestDevice } });
    mockApi({ 'GET /api/info': { body: serverInfoFixture('http://10.0.0.2/6/') } });
    renderWithProviders(<ProvisionPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Find device' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      "Error: No device selected — make sure it's in pairing mode.",
    );
    expect(screen.getByRole('log')).toHaveTextContent('ERROR NotFoundError: User cancelled');
  });

  it('names a device that offers neither provisioning service', async () => {
    setEnvironment({ secure: true, bluetooth: bluetoothWith('Petkit_Mini') });
    mockApi({ 'GET /api/info': { body: serverInfoFixture('http://10.0.0.2/6/') } });
    renderWithProviders(<ProvisionPage />);
    await userEvent.type(screen.getByLabelText(/Wi-Fi name/), 'Home');
    await userEvent.type(screen.getByLabelText(/^Password/), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Send to device' }));
    expect(await screen.findByText('Unknown device.')).toBeInTheDocument();
    expect(screen.getByRole('log')).toHaveTextContent('Feeder Mini have no Bluetooth setup');
  });

  it('provisions an Ingenic device end to end, then watches for it to register', async () => {
    const tx = new FakeCharacteristic(BLE_TX, { notify: true });
    const rx = new FakeCharacteristic(BLE_RX, { write: true });
    const answers: Record<number, object[]> = {
      110: [{}],
      151: [{ state: 1 }],
      112: [{ state: 10 }, { state: 10 }],
    };
    let sentPayload: unknown;
    rx.onWrite = bytes => {
      const msg = pkParse(bytes);
      if (msg?.key === undefined) return;
      if (msg.key === 151) sentPayload = msg.payload;
      const next = answers[msg.key]?.shift();
      if (next) tx.notify(pkFrame(0, { key: msg.key, payload: next }));
    };
    setEnvironment({
      secure: true,
      bluetooth: bluetoothWith('Petkit_T6_8F2A', {
        [BLE_SERVICE]: new FakeService(BLE_SERVICE, [tx, rx]),
      }),
    });
    let deviceCalls = 0;
    mockApi({
      'GET /api/info': { body: serverInfoFixture('http://10.0.0.2/6/') },
      'GET /api/devices': () => ({ body: ++deviceCalls === 1 ? [] : [deviceSummary] }),
    });
    renderWithProviders(<ProvisionPage />);
    await screen.findByDisplayValue('http://10.0.0.2/6/');
    await userEvent.type(screen.getByLabelText(/Wi-Fi name/), 'Home');
    await userEvent.type(screen.getByLabelText(/^Password/), 'secret');

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Send to device' }));
      await act(() => vi.advanceTimersByTimeAsync(30_000));
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Device connected. See the Devices page.',
      );
    });
    const log = screen.getByRole('log');
    expect(log).toHaveTextContent('protocol: PetKit (0xAAA0)');
    expect(log).toHaveTextContent('device joined — sending completion (key 101)');
    expect(log).toHaveTextContent('device connected: Litter box #42');
    expect(sentPayload).toMatchObject({
      ssid: 'Home',
      pwd: 'secret',
      hide: 1,
      apiServers: ['http://10.0.0.2/6/'],
      ipServers: ['http://10.0.0.2/6/'],
    });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
  });
});
