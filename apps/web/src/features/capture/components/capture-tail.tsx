import { errorMessage } from '@/shared/api/errors';
import { Button, EmptyBlock, ErrorBlock, Skeleton } from '@/shared/ui';
import { useCaptureTail } from '../api';

export interface CaptureTailProps {
  name: string | null;
  downloading: boolean;
  deleting: boolean;
  onDownload: (name: string) => void;
  onDelete: (name: string) => void;
}

/** One record per line, as written: a malformed line arrives as `{"raw": ...}` and stays visible. */
function recordLine(record: unknown): string {
  return JSON.stringify(record);
}

/** The selected file's tail, with its download and delete actions. */
export function CaptureTail({
  name,
  downloading,
  deleting,
  onDownload,
  onDelete,
}: CaptureTailProps) {
  const tail = useCaptureTail(name);

  if (name === null) {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        <EmptyBlock>Pick a file to read its last records.</EmptyBlock>
      </div>
    );
  }

  let body;
  let caption = 'Tail of the file · secrets are masked in this view only';
  if (tail.isPending) {
    body = <Skeleton height={420} />;
  } else if (tail.isError) {
    body = (
      <ErrorBlock
        message={`Could not read ${name}: ${errorMessage(tail.error)}`}
        onRetry={() => void tail.refetch()}
        retrying={tail.isFetching}
      />
    );
  } else {
    const { records, total } = tail.data;
    caption = `Last ${records.length} of ${total} lines · secrets are masked in this view only`;
    body = records.length ? (
      <pre
        className="min-h-[560px] max-h-[600px] overflow-auto rounded-lg border border-border bg-background px-4 py-3.5 font-mono text-xs leading-[1.7] whitespace-pre"
        aria-label={`Last records of ${name}`}
      >
        {records.map(recordLine).join('\n')}
      </pre>
    ) : (
      <EmptyBlock>This file is empty.</EmptyBlock>
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="capture-tail-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="capture-tail-title" className="font-mono text-base font-medium wrap-anywhere">
          {name}
        </h2>
        <div className="flex items-center gap-4">
          <Button
            disabled={downloading}
            onClick={() => {
              onDownload(name);
            }}
          >
            {downloading ? 'Downloading…' : 'Download'}
          </Button>
          <Button
            variant="destructive"
            disabled={deleting}
            onClick={() => {
              onDelete(name);
            }}
          >
            Delete
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{caption}</p>
      {body}
    </section>
  );
}
