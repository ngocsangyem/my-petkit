import { Trans, useTranslation } from 'react-i18next';
import type { components } from '@/api/schema';
import { i18n } from '@/i18n';
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
    return i18n.t('capture:files.emptyOff');
  }
  return i18n.t('capture:files.empty');
}

/** The file list and the facts about where captures live and how long they stay. */
export function CaptureFiles({ listing, selected, onSelect }: CaptureFilesProps) {
  const { t } = useTranslation('capture');
  const dir = listing.dir || '/data/capture';
  return (
    <Card as="section" className="flex flex-col gap-3" aria-labelledby="capture-files-title">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="capture-files-title">{t('files.title')}</h2>
        <span className="text-sm text-muted-foreground">{formatBytes(totalBytes(listing))}</span>
      </div>
      {listing.files.length === 0 ? (
        <EmptyBlock>{emptyText(listing)}</EmptyBlock>
      ) : (
        <Table
          label={t('files.label')}
          rows={listing.files}
          rowKey={f => f.name}
          selectedKey={selected}
          columns={[
            {
              key: 'name',
              header: t('files.file'),
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
            { key: 'lines', header: t('files.lines'), numeric: true, cell: f => f.lines },
            { key: 'size', header: t('files.size'), numeric: true, cell: f => formatBytes(f.size) },
          ]}
        />
      )}
      <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2.5 rounded-md bg-raised px-4 py-3.5 text-sm [&_dt]:text-muted-foreground">
        <dt>{t('files.stored')}</dt>
        <dd>
          <Trans
            t={t}
            i18nKey="files.storedBody"
            values={{ dir }}
            components={{ path: <span className="font-mono text-xs wrap-anywhere" /> }}
          />
        </dd>
        <dt>{t('files.kept')}</dt>
        <dd>{t('files.keptBody', { size: formatBytes(totalBytes(listing)) })}</dd>
        <dt>{t('files.delete')}</dt>
        <dd>{t('files.deleteBody')}</dd>
        <dt>{t('files.sharing')}</dt>
        <dd>{t('files.sharingBody')}</dd>
      </dl>
    </Card>
  );
}
