import { mockApi } from '@/test/mock-api';
import { api, unwrap } from './client';
import { onSignedOut, promptForCredential, setCredentialHandler } from './credential-prompt';
import { ApiError } from './errors';

const stepUp = { status: 403, body: { error: { code: 'step_up_required', message: 'Again.' } } };

afterEach(() => {
  setCredentialHandler(null);
});

describe('the API client', () => {
  it('asks once on step_up_required and replays the same body', async () => {
    let attempts = 0;
    const calls = mockApi({
      'POST /api/settings': () => (++attempts === 1 ? stepUp : { body: { ok: true } }),
    });
    const handler = vi.fn(() => Promise.resolve(true));
    setCredentialHandler(handler);
    await unwrap(api.POST('/api/settings', { body: { proxy_mode: true } }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
    expect(await calls[1]!.json()).toEqual({ proxy_mode: true });
  });

  it('does not loop when the replay is refused again', async () => {
    const calls = mockApi({ 'POST /api/settings': stepUp });
    setCredentialHandler(() => Promise.resolve(true));
    await expect(unwrap(api.POST('/api/settings', { body: {} }))).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(2);
  });

  it('gives up without replaying when the prompt is cancelled', async () => {
    const calls = mockApi({ 'POST /api/settings': stepUp });
    setCredentialHandler(() => Promise.resolve(false));
    await expect(unwrap(api.POST('/api/settings', { body: {} }))).rejects.toMatchObject({
      code: 'step_up_required',
    });
    expect(calls).toHaveLength(1);
  });

  it("reports a 401 as signed out, except the gate's own probe and the sign-in routes", async () => {
    const unauthorized = { status: 401, body: { error: { code: 'unauthorized', message: 'No.' } } };
    mockApi({
      'GET /api/devices': unauthorized,
      'GET /api/info': unauthorized,
      'POST /api/auth/login': unauthorized,
    });
    const listener = vi.fn();
    const off = onSignedOut(listener);
    await api.GET('/api/info');
    await api.POST('/api/auth/login', { body: { password: 'x' } });
    expect(listener).not.toHaveBeenCalled();
    await api.GET('/api/devices');
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });
});

describe('the credential prompt', () => {
  it('shares one dialog between requests that need it at the same time', async () => {
    let resolve: (ok: boolean) => void = () => undefined;
    const handler = vi.fn(() => new Promise<boolean>(r => (resolve = r)));
    setCredentialHandler(handler);
    const first = promptForCredential('step-up');
    const second = promptForCredential('step-up');
    resolve(true);
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
