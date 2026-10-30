import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, type MockReply } from '@/test/mock-api';
import { renderWithProviders } from '@/test/render';
import type { LiveInfo, LiveReason } from './live-api';
import { REASON_SENTENCE } from './live-copy';
import { FakeMediaSource, FakePeerConnection, FakeWebSocket, installLiveFakes } from './live-fakes';
import { LiveView } from './live-view';

const ID = 100234567;
const LIVE = `GET /api/devices/${ID}/live`;

function info(over: Partial<LiveInfo> = {}): LiveInfo {
  return {
    available: true,
    reason: null,
    modes: ['mse', 'hls'],
    hls_url: `/api/live/${ID}/stream.m3u8?exp=1&sig=abc`,
    ...over,
  };
}

function renderLive(routes: Record<string, MockReply>) {
  const calls = mockApi(routes);
  const view = renderWithProviders(<LiveView deviceId={ID} deviceName="Litter box" />);
  return { calls, ...view };
}

const video = () => screen.getByLabelText<HTMLVideoElement>('Live video from Litter box');
const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

let fakes: ReturnType<typeof installLiveFakes>;
beforeEach(() => {
  fakes = installLiveFakes();
});
afterEach(() => {
  // Unmount while the media stubs are still in place: unmounting stops the session.
  cleanup();
  vi.restoreAllMocks();
});

describe('live view info states', () => {
  it.each(Object.entries(REASON_SENTENCE) as [LiveReason, string][])(
    'explains %s in one sentence with Retry',
    async (reason, sentence) => {
      const { calls } = renderLive({
        [LIVE]: { body: info({ available: false, reason, modes: [], hls_url: null }) },
      });
      expect(await screen.findByRole('alert')).toHaveTextContent(sentence);
      await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
      await waitFor(() => {
        expect(calls.filter(c => c.url.endsWith('/live'))).toHaveLength(2);
      });
      expect(screen.queryByRole('button', { name: 'Watch' })).toBeNull();
    },
  );

  it('offers Watch when available and connects nothing until it is pressed', async () => {
    renderLive({ [LIVE]: { body: info() } });
    expect(await screen.findByRole('button', { name: 'Watch' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(video().muted).toBe(true);
    expect(FakeMediaSource.instances).toHaveLength(0);
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(FakePeerConnection.instances).toHaveLength(0);
  });

  it('keeps a failed info request inside the block', async () => {
    renderLive({
      [LIVE]: { status: 500, body: { error: { code: 'internal', message: 'Boom.' } } },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not check the live stream: Boom.',
    );
  });
});

describe('live mode picker', () => {
  it('shows only the offered modes, the first chosen, with its sentence', async () => {
    renderLive({ [LIVE]: { body: info({ modes: ['mse', 'hls'] }) } });
    await screen.findByRole('button', { name: 'MSE' });
    expect(screen.getByRole('button', { name: 'HLS' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'WebRTC' })).toBeNull();
    expect(pressed('MSE')).toBe('true');
    expect(screen.getByText(/^MSE: /)).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'HLS' }));
    expect(pressed('HLS')).toBe('true');
    expect(screen.getByText('HLS: works everywhere, a few seconds behind.')).toBeInTheDocument();
  });

  it('leaves out the modes this browser cannot play, as on iOS Safari', async () => {
    vi.stubGlobal('MediaSource', undefined);
    renderLive({ [LIVE]: { body: info({ modes: ['mse', 'hls'] }) } });
    await screen.findByRole('button', { name: 'HLS' });
    expect(screen.queryByRole('button', { name: 'MSE' })).toBeNull();
    expect(pressed('HLS')).toBe('true');
  });
});

describe('live playback', () => {
  it('falls back from WebRTC to the next mode on 409 webrtc_unavailable', async () => {
    const { calls } = renderLive({
      [LIVE]: { body: info({ modes: ['webrtc', 'mse', 'hls'] }) },
      [`POST /api/live/${ID}/webrtc`]: {
        status: 409,
        body: { error: { code: 'webrtc_unavailable', message: 'Not set up.' } },
      },
    });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Watch' }));

    await waitFor(() => {
      expect(pressed('MSE')).toBe('true');
    });
    const [pc] = FakePeerConnection.instances;
    expect(pc?.transceivers).toEqual([
      { kind: 'video', direction: 'recvonly' },
      { kind: 'audio', direction: 'recvonly' },
    ]);
    expect(pc?.closed).toBe(true);
    const offer = calls.find(c => c.method === 'POST');
    expect(await offer?.json()).toEqual({ type: 'offer', sdp: 'v=0 offer' });
    expect(screen.getByText(/Using MSE instead/)).toBeInTheDocument();
    expect(FakeMediaSource.instances).toHaveLength(1);
  });

  it('runs the MSE handshake with supported codecs and the server mime', async () => {
    const { container } = renderLive({ [LIVE]: { body: info() } });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Watch' }));
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Connecting over MSE');

    const source = FakeMediaSource.instances[0]!;
    source.open();
    const ws = FakeWebSocket.instances[0]!;
    expect(ws.url).toMatch(new RegExp(`^ws://[^/]+/api/live/${ID}/mse$`));
    ws.serverOpens();
    expect(ws.sent.map(s => JSON.parse(s) as unknown)).toEqual([
      { type: 'mse', value: 'avc1.640029,mp4a.40.2,opus' },
    ]);

    const mime = 'video/mp4; codecs="avc1.640029,mp4a.40.2"';
    ws.serverSends(JSON.stringify({ type: 'mse', value: mime }));
    expect(source.mimes).toEqual([mime]);
    const init = new ArrayBuffer(8);
    ws.serverSends(init);
    expect(source.buffers[0]?.appended).toEqual([init]);

    video().dispatchEvent(new Event('playing'));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Live over MSE');
    });
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
  });

  it('shows the server error and offers Retry', async () => {
    renderLive({ [LIVE]: { body: info() } });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Watch' }));
    FakeMediaSource.instances[0]!.open();
    FakeWebSocket.instances[0]!.serverSends(
      JSON.stringify({ type: 'error', value: 'The live stream did not answer.' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('The live stream did not answer.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('plays HLS from a freshly signed link under the mount point', async () => {
    fakes.canPlayType.mockImplementation(() => 'maybe');
    const { calls } = renderLive({
      [LIVE]: { body: info({ modes: ['hls'], hls_url: `/api/live/${ID}/stream.m3u8?sig=new` }) },
    });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Watch' }));
    await waitFor(() => {
      expect(video().getAttribute('src')).toBe(`/api/live/${ID}/stream.m3u8?sig=new`);
    });
    expect(calls.filter(c => c.url.endsWith('/live'))).toHaveLength(2);
  });
});

describe('live cleanup', () => {
  it('closes the MSE socket and frees the buffer on unmount', async () => {
    const { unmount } = renderLive({ [LIVE]: { body: info() } });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Watch' }));
    FakeMediaSource.instances[0]!.open();
    const ws = FakeWebSocket.instances[0]!;
    unmount();
    expect(ws.closed).toBe(true);
    expect(fakes.revoked).toEqual(['blob:live']);
  });

  it('closes the peer connection on unmount', async () => {
    const { unmount } = renderLive({
      [LIVE]: { body: info({ modes: ['webrtc', 'mse'] }) },
      [`POST /api/live/${ID}/webrtc`]: { body: { type: 'answer', sdp: 'v=0 answer' } },
    });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Watch' }));
    const pc = FakePeerConnection.instances[0]!;
    await waitFor(() => {
      expect(pc.remoteDescription).toEqual({ type: 'answer', sdp: 'v=0 answer' });
    });
    unmount();
    expect(pc.closed).toBe(true);
  });

  it('closes the old connection when the mode changes', async () => {
    fakes.canPlayType.mockImplementation(() => 'maybe');
    renderLive({ [LIVE]: { body: info() } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Watch' }));
    FakeMediaSource.instances[0]!.open();
    const ws = FakeWebSocket.instances[0]!;
    await user.click(screen.getByRole('button', { name: 'HLS' }));
    expect(ws.closed).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('Connecting over HLS');
  });
});
