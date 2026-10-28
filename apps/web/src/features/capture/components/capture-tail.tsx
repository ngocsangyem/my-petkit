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
      <div className="capture-tail">
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
      <pre className="capture-tail__records" aria-label={`Last records of ${name}`}>
        {records.map(recordLine).join('\n')}
      </pre>
    ) : (
      <EmptyBlock>This file is empty.</EmptyBlock>
    );
  }

  return (
    <section className="capture-tail" aria-labelledby="capture-tail-title">
      <div className="capture-tail__head">
        <h2 id="capture-tail-title" className="capture-tail__name">
          {name}
        </h2>
        <div className="capture-tail__actions">
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
      <p className="capture-tail__caption">{caption}</p>
      {body}
    </section>
  );
}
