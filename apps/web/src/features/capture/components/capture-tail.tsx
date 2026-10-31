import { errorMessage } from '@/shared/api/errors';
import { Button, Card, EmptyBlock, ErrorBlock, Icon, Skeleton } from '@/shared/ui';
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
      <Card>
        <EmptyBlock>Pick a file to read its last records.</EmptyBlock>
      </Card>
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
        className="max-h-[600px] min-h-[240px] overflow-auto rounded-md bg-raised px-4 py-3.5 font-mono text-xs leading-[1.7] whitespace-pre"
        aria-label={`Last records of ${name}`}
      >
        {records.map(recordLine).join('\n')}
      </pre>
    ) : (
      <EmptyBlock>This file is empty.</EmptyBlock>
    );
  }

  return (
    <Card as="section" className="flex flex-col gap-3" aria-labelledby="capture-tail-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="capture-tail-title" className="wrap-anywhere">
          Last lines of <span className="font-mono text-base font-medium">{name}</span>
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="small"
            disabled={downloading}
            onClick={() => {
              onDownload(name);
            }}
          >
            <Icon name="download" size={14} />
            {downloading ? 'Downloading…' : 'Download'}
          </Button>
          <Button
            variant="destructive"
            size="small"
            disabled={deleting}
            onClick={() => {
              onDelete(name);
            }}
          >
            <Icon name="trash" size={14} />
            Delete
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{caption}</p>
      {body}
    </Card>
  );
}
