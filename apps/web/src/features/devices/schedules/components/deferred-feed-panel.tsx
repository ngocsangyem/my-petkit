import { errorMessage } from '@/shared/api/errors';
import { Button, EmptyBlock, ErrorBlock, Pill, SectionCard, Skeleton } from '@/shared/ui';
import { useDeferredFeeds, useDeleteDeferredFeed } from '../api';
import { formatDeviceMoment, formatOffset } from '../schedule-clock';
import { DeferredFeedForm } from './deferred-feed-form';

interface DeferredFeedPanelProps {
  deviceId: number;
  /** Show the second hopper's portions. */
  dual: boolean;
  /** Hours east of UTC on the device's clock (`timezoneInfo.effective`, what the server uses). */
  offset: number;
}

/**
 * One-off feeds. The date and time are read on the DEVICE's clock, both when
 * the server turns them into `fire_at` and when this list prints `fire_at`
 * back, so the browser's own zone never enters into it.
 */
export function DeferredFeedPanel({ deviceId, dual, offset }: DeferredFeedPanelProps) {
  const feeds = useDeferredFeeds(deviceId);
  const remove = useDeleteDeferredFeed(deviceId);

  if (feeds.isPending) {
    return (
      <div className="flex min-w-0 flex-col gap-2" aria-busy="true">
        <Skeleton height={48} />
        <Skeleton height={32} />
      </div>
    );
  }
  if (feeds.isError) {
    return (
      <ErrorBlock
        message={`One-off feeds could not be loaded: ${errorMessage(feeds.error)}`}
        retrying={feeds.isFetching}
        onRetry={() => {
          void feeds.refetch();
        }}
      />
    );
  }

  const zone = formatOffset(offset);
  return (
    <SectionCard title="Deferred feed" aside="Sent when the feeder next polls">
      {feeds.data.length ? (
        <div className="flex flex-col">
          {feeds.data.map(feed => (
            <div
              className="flex min-h-13 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-rule py-2 first:border-t-0"
              key={feed.id}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <span className="font-semibold">{formatDeviceMoment(feed.fire_at, offset)}</span>
                <span className="text-sm text-muted-foreground">
                  {dual ? `Hopper 1: ${feed.a1}, Hopper 2: ${feed.a2}` : `Portions: ${feed.a1}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Pill>Waiting</Pill>
                <Button
                  variant="ghost"
                  size="small"
                  disabled={remove.isPending}
                  onClick={() => {
                    remove.mutate(feed.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyBlock>No one-off feeds scheduled.</EmptyBlock>
      )}
      {remove.isError && (
        <p className="text-sm text-negative" role="alert">
          Not removed: {errorMessage(remove.error)}
        </p>
      )}
      <DeferredFeedForm deviceId={deviceId} dual={dual} offset={offset} />
      <p className="text-xs text-muted-foreground">
        Date and time are on the feeder's own clock ({zone}). The feeder picks the meal up on its
        next check-in.
      </p>
    </SectionCard>
  );
}
