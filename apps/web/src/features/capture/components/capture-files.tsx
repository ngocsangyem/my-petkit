import type { components } from '@/api/schema';
import { formatBytes } from '@/shared/format/format';
import { EmptyBlock, Table } from '@/shared/ui';

type CaptureListing = components['schemas']['CaptureListing'];

export interface CaptureFilesProps {
  listing: CaptureListing;
  selected: string | null;
  onSelect: (name: string) => void;
}

/** Sum of every file's size, for "Total on disk". */
export function totalBytes(listing: CaptureListing): number {
  return listing.files.reduce((n, f) => n + f.size, 0);
}

function emptyText(listing: CaptureListing): string {
  if (!listing.enabled) {
    return 'Capture is off. Turn Traffic capture on in Setup to start recording; it applies immediately, with no restart.';
  }
  return 'No files yet. Traffic will appear once a device talks to this app.';
}

/** The file list and the facts about where captures live and how long they stay. */
export function CaptureFiles({ listing, selected, onSelect }: CaptureFilesProps) {
  const dir = listing.dir || '/data/capture';
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-labelledby="capture-files-title">
      <h2 id="capture-files-title">Capture files</h2>
      {listing.files.length === 0 ? (
        <EmptyBlock>{emptyText(listing)}</EmptyBlock>
      ) : (
        <Table
          label="Capture files"
          rows={listing.files}
          rowKey={f => f.name}
          selectedKey={selected}
          columns={[
            {
              key: 'name',
              header: 'Name',
              mono: true,
              cell: f => (
                <button
                  type="button"
                  className="text-left font-mono text-sm wrap-anywhere hover:text-data aria-pressed:font-medium"
                  aria-pressed={f.name === selected}
                  onClick={() => {
                    onSelect(f.name);
                  }}
                >
                  {f.name}
                </button>
              ),
            },
            { key: 'lines', header: 'Lines', numeric: true, cell: f => f.lines },
            { key: 'size', header: 'Size', numeric: true, cell: f => formatBytes(f.size) },
          ]}
        />
      )}
      <dl className="mt-2 grid grid-cols-[140px_minmax(0,1fr)] gap-x-4 gap-y-2.5 rounded-lg bg-raised p-4 text-sm [&_dt]:text-muted-foreground">
        <dt>Stored</dt>
        <dd>
          On this server only, in <span className="font-mono text-xs wrap-anywhere">{dir}</span>.
          Nothing is uploaded.
        </dd>
        <dt>Recording</dt>
        <dd>
          {listing.enabled
            ? 'On. Every device HTTP request and MQTT frame is written as it happens.'
            : 'Off. Turning it on is a setting in Setup, and asks for your password again.'}
        </dd>
        <dt>Kept</dt>
        <dd>
          Nothing prunes these: a capture is deliberate, so it is kept in full until you delete it.
          Total on disk: {formatBytes(totalBytes(listing))}.
        </dd>
        <dt>Delete</dt>
        <dd>Removes the file for good. There is no bin.</dd>
        <dt>Sharing</dt>
        <dd>Read the tail first. Attach only the one file that answers the question.</dd>
      </dl>
    </section>
  );
}
