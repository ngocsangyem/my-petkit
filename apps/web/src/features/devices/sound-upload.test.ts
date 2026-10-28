import { mockApi } from '@/test/mock-api';
import { uploadSound } from './api-calls';

describe('uploadSound', () => {
  it('sends the file as multipart form data, not JSON', async () => {
    const calls = mockApi({ 'POST /api/devices/7/sounds': { body: { ok: true } } });
    const file = new File([new Uint8Array([1, 2, 3])], 'dinner.mp3', { type: 'audio/mpeg' });
    await uploadSound(7, file);
    const sent = calls[0]!;
    expect(sent.headers.get('Content-Type')).toMatch(/^multipart\/form-data; boundary=/);
    // jsdom's File crosses into undici's FormData as a plain blob, so the file
    // name is lost here (a browser sends it); the part and its type are checked.
    const body = await sent.text();
    expect(body).toMatch(/Content-Disposition: form-data; name="file"; filename=/);
    expect(body).toMatch(/Content-Type: audio\/mpeg/);
  });
});
