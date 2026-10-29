import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '@/test/mock-api';
import { renderWithProviders } from '@/test/render';
import { CapturePage } from './capture-page';

const listing = {
  dir: '/data/capture',
  enabled: true,
  files: [
    { name: 'requests.jsonl', size: 2_516_582, lines: 10 },
    { name: 'mqtt #2.jsonl', size: 2048, lines: 0 },
  ],
};

// jsdom has no object URLs; the saved blob is read back from this spy.
const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:x');

beforeEach(() => {
  createObjectURL.mockClear();
  Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
});

function routes(files = listing.files) {
  let current = files;
  return mockApi({
    'GET /api/capture': () => ({ body: { ...listing, files: current } }),
    'GET /api/capture/requests.jsonl': {
      body: {
        records: [{ path: '/6/t6/dev_heartbeat', secret: '••••' }, { raw: 'not json' }],
        total: 10,
      },
    },
    'GET /api/capture/requests.jsonl/download': { body: 'raw' },
    'DELETE /api/capture/mqtt%20%232.jsonl': () => {
      current = current.filter(f => f.name !== 'mqtt #2.jsonl');
      return { body: { ok: true, name: 'mqtt #2.jsonl' } };
    },
  });
}

describe('CapturePage', () => {
  it('lists the files with the secret warning and the step-up pill', async () => {
    routes();
    renderWithProviders(<CapturePage />);
    expect(await screen.findByText(/recording · 2 files, 2\.4 MB/)).toBeInTheDocument();
    expect(screen.getByText('Step-up required')).toBeInTheDocument();
    expect(screen.getByText(/Every capture is sensitive/)).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Capture files' });
    expect(within(table).getByRole('button', { name: 'mqtt #2.jsonl' })).toBeInTheDocument();
    expect(within(table).getByText('0')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Recording settings' })).toHaveAttribute(
      'href',
      '/setup',
    );
  });

  it('reads the tail of a file, one record per line, malformed lines kept', async () => {
    routes();
    renderWithProviders(<CapturePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'requests.jsonl' }));
    expect(await screen.findByText(/Last 2 of 10 lines/)).toBeInTheDocument();
    const pre = screen.getByLabelText('Last records of requests.jsonl');
    expect(pre.textContent).toBe(
      '{"path":"/6/t6/dev_heartbeat","secret":"••••"}\n{"raw":"not json"}',
    );
  });

  it('downloads through the API client and saves the blob', async () => {
    const calls = routes();
    renderWithProviders(<CapturePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'requests.jsonl' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Download' }));
    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalled();
    });
    expect(calls.some(r => r.url.endsWith('/api/capture/requests.jsonl/download'))).toBe(true);
  });

  it('deletes a file only after confirming, then drops it from the list', async () => {
    const calls = routes();
    renderWithProviders(<CapturePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'mqtt #2.jsonl' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete mqtt #2.jsonl?' });
    expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Deleted mqtt #2.jsonl')).toBeInTheDocument();
    expect(calls.some(r => r.method === 'DELETE')).toBe(true);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'mqtt #2.jsonl' })).toBeNull();
    });
    expect(screen.getByText('Pick a file to read its last records.')).toBeInTheDocument();
  });

  it('says how to start recording when capture is off and empty', async () => {
    mockApi({ 'GET /api/capture': { body: { dir: '', enabled: false, files: [] } } });
    renderWithProviders(<CapturePage />);
    expect(await screen.findByText(/Capture is off\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start recording' })).toBeInTheDocument();
  });

  it('keeps a listing error inside its block with Retry', async () => {
    mockApi({
      'GET /api/capture': { status: 500, body: { error: { code: 'internal', message: 'Boom.' } } },
    });
    renderWithProviders(<CapturePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not list the capture files: Boom.',
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
