import type { components } from '@/api/schema';
import { formatBytes } from '@/shared/format/format';
import { Card, EmptyBlock, Table } from '@/shared/ui';

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
    return 'Capture is off. Turn on Save traffic under Settings to start recording; it applies immediately, with no restart.';
  }
  return 'No files yet. Traffic will appear once a device talks to this app.';
}

/** The file list and the facts about where captures live and how long they stay. */
export function CaptureFiles({ listing, selected, onSelect }: CaptureFilesProps) {
  const dir = listing.dir || '/data/capture';
  return (
    <Card as="section" className="flex flex-col gap-3" aria-labelledby="capture-files-title">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="capture-files-title">Files</h2>
        <span className="text-sm text-muted-foreground">{formatBytes(totalBytes(listing))}</span>
      </div>
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
              header: 'File',
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
      <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2.5 rounded-md bg-raised px-4 py-3.5 text-sm [&_dt]:text-muted-foreground">
        <dt>Stored</dt>
        <dd>
          On this server only, in <span className="font-mono text-xs wrap-anywhere">{dir}</span>.
          Nothing is uploaded.
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
    </Card>
  );
}
