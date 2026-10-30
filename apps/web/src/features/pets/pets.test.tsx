import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mockApi, type MockReply } from '@/test/mock-api';
import { renderWithProviders } from '@/test/render';
import { uploadFace } from './api';
import { deviceDetail, deviceSummary, pet, unboundRef } from './pets-fixtures';
import { PetsPage } from './pets-page';

/** A day of Miso's history: two visits weighed 5.40 and 5.44 kg, so the day reads 5.42. */
const historyDay: MockReply = request => {
  const date = new URL(request.url).searchParams.get('date') ?? '';
  const visit = (id: number, weight: number) => ({
    id,
    kind: 'visit',
    pet_id: 1,
    weight,
  });
  return {
    body: {
      date,
      tz_offset: 0,
      counts: {
        all: 2,
        pet: 0,
        toileting: 2,
        drinking: 0,
        feeding: 0,
        cleaning: 0,
        health_alert: 0,
        fault: 0,
        passing: 0,
      },
      sessions: [visit(1, 5400), visit(2, 5440)],
    },
  };
};

function routes(over: Record<string, MockReply> = {}): Record<string, MockReply> {
  return {
    'GET /api/devices': { body: [deviceSummary()] },
    'GET /api/devices/10001': { body: deviceDetail({}, [11, 12]) },
    'GET /api/pets': { body: { pets: [pet()] } },
    'GET /api/pets/unbound': { body: { unbound: [unboundRef] } },
    'GET /api/info': { body: { ai_device_names: ['T5', 'T6'] } },
    'GET /api/timeline': historyDay,
    ...over,
  };
}

async function jsonBody(calls: Request[], method: string, path: string): Promise<unknown> {
  const call = calls.find(c => c.method === method && new URL(c.url).pathname === path);
  expect(call, `${method} ${path}`).toBeDefined();
  return call ? ((await call.clone().json()) as unknown) : undefined;
}

describe('PetsPage', () => {
  it('shows each pet with its photos, status and the finding line', async () => {
    mockApi(routes());
    renderWithProviders(<PetsPage />);
    const card = await screen.findByRole('article', { name: 'Miso' });
    expect(within(card).getByText('Loaded on Litter box')).toBeInTheDocument();
    expect(within(card).getByText('Alias 88412')).toBeInTheDocument();
    const photo = within(card).getByAltText('Face photo 1 of Miso');
    expect(photo.getAttribute('src')).toBe('/api/pets/1/faces/11/photo');
    expect(screen.getByText(/Miso is recognised\./)).toBeInTheDocument();
    expect(screen.getByText(/1 reported identity has no pet yet/)).toBeInTheDocument();
  });

  it('says a pet is waiting while the device has not fetched its photos', async () => {
    mockApi(routes({ 'GET /api/devices/10001': { body: deviceDetail({}, [99]) } }));
    renderWithProviders(<PetsPage />);
    const card = await screen.findByRole('article', { name: 'Miso' });
    expect(within(card).getByText('Waiting for device to fetch')).toBeInTheDocument();
    expect(screen.getByText(/Not yours/)).toBeInTheDocument();
  });

  it('explains an empty screen when no device can recognise', async () => {
    mockApi(routes({ 'GET /api/devices': { body: [deviceSummary({ supports_ai: false })] } }));
    renderWithProviders(<PetsPage />);
    expect(await screen.findByText(/that is T5, T6/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a pet' })).not.toBeInTheDocument();
  });

  it('hides the pets while recognition is off everywhere, and turns it back on', async () => {
    const calls = mockApi(
      routes({
        'GET /api/devices/10001': { body: deviceDetail({}, [], false) },
        'POST /api/devices/10001/ai': { body: { ok: true, ai_enabled: true } },
      }),
    );
    renderWithProviders(<PetsPage />);
    expect(await screen.findByText(/Pet recognition is off/)).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Miso' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a pet' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Recognise pets' }));
    expect(await jsonBody(calls, 'POST', '/api/devices/10001/ai')).toEqual({ ai_enabled: true });
  });

  it('adds a pet assigned to the chosen device', async () => {
    const calls = mockApi(
      routes({ 'POST /api/pets': { body: { pet: pet({ id: 2, name: 'Mochi', faces: [] }) } } }),
    );
    renderWithProviders(<PetsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add a pet' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a pet' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add pet' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Give the pet a name.');
    await userEvent.type(within(dialog).getByLabelText('Name'), '  Mochi ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add pet' }));
    expect(await jsonBody(calls, 'POST', '/api/pets')).toEqual({
      name: 'Mochi',
      device_ids: [10001],
    });
    expect(await screen.findByText('Added Mochi')).toBeInTheDocument();
  });

  it('renames in place on Enter and keeps the name on Escape', async () => {
    const calls = mockApi(
      routes({ 'POST /api/pets/1': { body: { pet: pet({ name: 'Tofu' }), bound_events: 0 } } }),
    );
    renderWithProviders(<PetsPage />);
    const card = await screen.findByRole('article', { name: 'Miso' });
    await userEvent.click(within(card).getByRole('button', { name: 'Rename' }));
    await userEvent.keyboard('{Escape}');
    expect(calls.some(c => c.method === 'POST')).toBe(false);

    await userEvent.click(within(card).getByRole('button', { name: 'Rename' }));
    const input = within(card).getByLabelText('Pet name');
    await userEvent.clear(input);
    await userEvent.type(input, 'Tofu{Enter}');
    expect(await jsonBody(calls, 'POST', '/api/pets/1')).toEqual({ name: 'Tofu' });
    expect(calls.filter(c => c.method === 'POST')).toHaveLength(1);
  });

  it('deletes a pet and a face photo only after confirming', async () => {
    const calls = mockApi(
      routes({
        'DELETE /api/pets/1': { body: { ok: true } },
        'DELETE /api/pets/1/faces/12': { body: { ok: true } },
      }),
    );
    renderWithProviders(<PetsPage />);
    const card = await screen.findByRole('article', { name: 'Miso' });

    await userEvent.click(
      within(card).getByRole('button', { name: 'Remove face photo 2 of Miso' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    await waitFor(() => {
      expect(calls.some(c => c.method === 'DELETE' && c.url.endsWith('/faces/12'))).toBe(true);
    });

    await userEvent.click(within(card).getByRole('button', { name: 'Delete Miso' }));
    expect(screen.getByRole('alertdialog', { name: 'Delete Miso?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete pet' }));
    await waitFor(() => {
      expect(calls.some(c => c.method === 'DELETE' && c.url.endsWith('/api/pets/1'))).toBe(true);
    });
  });

  it('binds an unbound identity without dropping the existing alias', async () => {
    const calls = mockApi(
      routes({
        'GET /api/pets/1': { body: { pet: pet() } },
        'POST /api/pets/1': { body: { pet: pet(), bound_events: 3 } },
      }),
    );
    renderWithProviders(<PetsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Bind 555 to Miso' }));
    expect(await jsonBody(calls, 'POST', '/api/pets/1')).toEqual({ device_pet_ids: [88412, 555] });
    expect(await screen.findByText('Bound: 3 past events attributed')).toBeInTheDocument();
  });

  it('imports from PetKit only after the dialog is confirmed', async () => {
    const calls = mockApi(
      routes({
        'POST /api/pets/import': {
          body: {
            imported: 1,
            results: [
              {
                pet_ref: 777,
                outcome: 'imported',
                pet_id: 3,
                name: 'PetKit pet 777',
                faces_imported: 2,
                faces_offered: 3,
                bound_events: 4,
              },
            ],
          },
        },
      }),
    );
    renderWithProviders(<PetsPage />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Import from PetKit account' }),
    );
    expect(calls.some(c => c.url.endsWith('/api/pets/import'))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(await jsonBody(calls, 'POST', '/api/pets/import')).toEqual({ device_id: 10001 });
    expect(
      await screen.findByText('Imported 1 pet, 2 of 3 photos, named 4 past events.'),
    ).toBeInTheDocument();
  });

  it('crops a picked photo to 224 and uploads it as a JPEG', async () => {
    const calls = mockApi(
      routes({
        'POST /api/pets/1/faces': { body: { face: { id: 13, url: 'api/pets/1/faces/13/photo' } } },
      }),
    );
    // jsdom has no image decoder or 2D canvas: stand in for both at the browser boundary.
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve({ width: 800, height: 600, close })),
    );
    const drawImage = vi.fn();
    const ctx = { clearRect: vi.fn(), drawImage };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ctx as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
      type?: string,
    ) {
      cb(new Blob([new Uint8Array([0xff, 0xd8, 0xff, this.width])], { type }));
    });

    renderWithProviders(<PetsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add a face photo for Miso' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a face photo of Miso' });
    const file = new File([new Uint8Array([1, 2, 3])], 'cat.jpg', { type: 'image/jpeg' });
    await userEvent.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, file);
    expect(await within(dialog).findByText(/One cat per photo/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Zoom')).toHaveValue('100');
    // Cover: a 4:3 photo fills the 224 preview by height, centred.
    expect(drawImage).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.closeTo(-37.33, 1),
      0,
      expect.closeTo(298.67, 1),
      224,
    );

    await userEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));
    await waitFor(() => {
      expect(calls.some(c => c.method === 'POST' && c.url.endsWith('/api/pets/1/faces'))).toBe(
        true,
      );
    });
    const upload = calls.find(c => c.method === 'POST');
    expect(upload?.headers.get('Content-Type')).toBe('image/jpeg');
    const bytes = new Uint8Array(await (upload ? upload.arrayBuffer() : new ArrayBuffer(0)));
    expect(Array.from(bytes)).toEqual([0xff, 0xd8, 0xff, 224]);
    expect(await screen.findByText('Photo added')).toBeInTheDocument();
    expect(close).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('opens the cropper with the face rules from the add tile', async () => {
    mockApi(routes());
    renderWithProviders(<PetsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add a face photo for Miso' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a face photo of Miso' });
    expect(within(dialog).getByText(/Drop a photo here/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('hides the add tile and disables upload once a pet has six photos', async () => {
    const faces = [1, 2, 3, 4, 5, 6].map(id => ({ id, url: `api/pets/1/faces/${id}/photo` }));
    mockApi(routes({ 'GET /api/pets': { body: { pets: [pet({ faces })] } } }));
    renderWithProviders(<PetsPage />);
    const card = await screen.findByRole('article', { name: 'Miso' });
    expect(within(card).queryByRole('button', { name: /Add a face photo/ })).toBeNull();
    expect(within(card).getByRole('button', { name: 'Photos full' })).toBeDisabled();
  });

  it('edits the registered weight and matching, sending only what changed', async () => {
    const calls = mockApi(
      routes({ 'POST /api/pets/1': { body: { pet: pet(), bound_events: 0 } } }),
    );
    renderWithProviders(<PetsPage />);
    const card = await screen.findByRole('article', { name: 'Miso' });
    // The profile row: "Registered weight" with its value.
    expect(within(card).getByText('5.43 kg')).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Edit weight' }));
    const dialog = screen.getByRole('dialog', { name: "Miso's weight" });
    const weight = within(dialog).getByLabelText('Registered weight');
    expect(weight).toHaveValue('5.43');
    expect(within(dialog).getByText('Only when no other cat is within 600 g.')).toBeInTheDocument();
    expect(within(dialog).getByText('1 of 15 cats on this box')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('switch', { name: 'Match by weight when the camera cannot' }),
    ).toBeChecked();

    await userEvent.type(within(dialog).getByLabelText('Weight tolerance'), '250');
    expect(within(dialog).getByText('Only when no other cat is within 500 g.')).toBeInTheDocument();
    await userEvent.clear(weight);
    await userEvent.type(weight, '50');
    expect(within(dialog).getByText('Enter a weight from 0.20 to 20.00 kg.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.clear(weight);
    await userEvent.type(weight, '4.8');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await jsonBody(calls, 'POST', '/api/pets/1')).toEqual({
      weight_g: 4800,
      weight_tolerance_g: 250,
    });
    expect(await screen.findByText("Saved Miso's weight settings")).toBeInTheDocument();
  });

  it('closes the weight dialog without a request when nothing changed', async () => {
    const calls = mockApi(routes());
    renderWithProviders(<PetsPage />);
    const card = await screen.findByRole('article', { name: 'Miso' });
    await userEvent.click(within(card).getByRole('button', { name: 'Edit weight tolerance' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('dialog', { name: "Miso's weight" })).not.toBeInTheDocument();
    expect(calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('turns matching by weight off from the profile, with its guard of twice the tolerance', async () => {
    const calls = mockApi(
      routes({ 'POST /api/pets/1': { body: { pet: pet(), bound_events: 0 } } }),
    );
    renderWithProviders(<PetsPage />);
    const card = await screen.findByRole('article', { name: 'Miso' });
    expect(within(card).getByText('Only when no other cat is within 600 g.')).toBeInTheDocument();
    expect(within(card).getByText('1 of 15 cats on this box')).toBeInTheDocument();
    await userEvent.click(
      within(card).getByRole('switch', { name: 'Match by weight when the camera cannot' }),
    );
    expect(await jsonBody(calls, 'POST', '/api/pets/1')).toEqual({ weight_match: false });
  });

  it("charts the pet's daily weight and visits from its timeline days", async () => {
    const calls = mockApi(routes());
    renderWithProviders(<PetsPage />);
    const card = await screen.findByRole('article', { name: 'Miso' });
    expect(await within(card).findByText('2.0 a day on average')).toBeInTheDocument();
    expect(within(card).getByText('±0.00 kg over 14 days')).toBeInTheDocument();
    expect(
      within(card).getByRole('img', { name: /^Miso's weight over 14 days, .* 5\.42 kg/ }),
    ).toBeInTheDocument();
    const days = calls.filter(c => new URL(c.url).pathname === '/api/timeline');
    expect(days).toHaveLength(14);
    const q = new URL(days[0]!.url).searchParams;
    expect([q.get('pet'), q.get('filter')]).toEqual(['1', 'toileting']);

    await userEvent.click(within(card).getByRole('button', { name: '1W' }));
    expect(
      within(card).getByRole('img', { name: /^Miso's weight over 7 days/ }),
    ).toBeInTheDocument();
  });

  it('switches between pets with their chips', async () => {
    mockApi(
      routes({
        'GET /api/pets': { body: { pets: [pet(), pet({ id: 2, name: 'Mochi', faces: [] })] } },
      }),
    );
    renderWithProviders(<PetsPage />);
    await screen.findByRole('article', { name: 'Miso' });
    const chips = screen.getByRole('group', { name: 'Pet shown' });
    await userEvent.click(within(chips).getByRole('button', { name: 'Mochi' }));
    expect(await screen.findByRole('article', { name: 'Mochi' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Miso' })).not.toBeInTheDocument();
  });

  it('shows the per-box limit when the server refuses another cat', async () => {
    mockApi(
      routes({
        'POST /api/pets': {
          status: 409,
          body: { error: { code: 'too_many_pets', message: 'device 10001 already has 15.' } },
        },
      }),
    );
    renderWithProviders(<PetsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add a pet' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a pet' });
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Tofu');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add pet' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'That box already recognises 15 cats, the most it can hold.',
    );
  });

  it('disables adding a pet once every box holds 15 cats', async () => {
    const pets = Array.from({ length: 15 }, (_, i) => pet({ id: i + 1, name: `Cat ${i + 1}` }));
    mockApi(routes({ 'GET /api/pets': { body: { pets } } }));
    renderWithProviders(<PetsPage />);
    await screen.findByRole('article', { name: 'Cat 1' });
    expect(screen.getByRole('button', { name: 'Add a pet' })).toBeDisabled();
  });

  it('keeps a load failure inside the page with Retry', async () => {
    mockApi(routes({ 'GET /api/pets': { status: 500, body: { error: 'store down' } } }));
    renderWithProviders(<PetsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the pets. store down',
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('uploadFace', () => {
  it('posts the raw JPEG bytes, not JSON or multipart', async () => {
    const calls = mockApi({
      'POST /api/pets/1/faces': { body: { face: { id: 9, url: 'api/pets/1/faces/9/photo' } } },
    });
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' });
    await expect(uploadFace(1, jpeg)).resolves.toEqual({
      face: { id: 9, url: 'api/pets/1/faces/9/photo' },
    });
    const call = calls[0];
    expect(call?.headers.get('Content-Type')).toBe('image/jpeg');
    const bytes = new Uint8Array(
      await (call ? call.arrayBuffer() : Promise.resolve(new ArrayBuffer(0))),
    );
    expect(Array.from(bytes)).toEqual([0xff, 0xd8, 0xff, 0xe0]);
  });

  it('names a 413 instead of answering an HTTP code', async () => {
    mockApi({ 'POST /api/pets/1/faces': { status: 413, body: 'Request Entity Too Large' } });
    await expect(uploadFace(1, new Blob([new Uint8Array([1])]))).rejects.toThrow(
      'That photo is too large.',
    );
  });

  it('passes the server refusal through', async () => {
    mockApi({
      'POST /api/pets/1/faces': { status: 400, body: { error: 'at most 6 photos per pet' } },
    });
    await expect(uploadFace(1, new Blob([new Uint8Array([1])]))).rejects.toThrow(
      'at most 6 photos per pet',
    );
  });
});
