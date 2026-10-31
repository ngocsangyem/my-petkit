import { useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { todayLocal } from '@/shared/format/local-day';
import { Card, EmptyBlock, ErrorBlock, PageHeader, Skeleton } from '@/shared/ui';
import { useTimelineDay, useTimelineDevices, useTimelinePets, type TimelineQuery } from './api';
import { ChangeCatDialog } from './components/change-cat-dialog';
import { TimelineDayNav } from './components/timeline-day-nav';
import { TimelineDayStrip } from './components/timeline-day-strip';
import { TimelineEventList } from './components/timeline-event-list';
import { TimelineFilterChips } from './components/timeline-filter-chips';
import { TimelineSessionDetail } from './components/timeline-session-detail';
import { useTimelineLiveRefresh } from './hooks/use-timeline-live-refresh';
import { sessionKey, type TimelineSession } from './timeline-model';
import { visitSummary } from './timeline-summary';
import {
  applyViewFilter,
  isUnrecognisedVisit,
  serverFilter,
  type ViewFilter,
} from './timeline-view-filter';

type ChangeTarget = TimelineSession & { id: number };

/**
 * One local day: the finding line and the day picker, one row of chips, the sessions beside the
 * selected one with its media, and the household strip under them.
 */
export function TimelinePage() {
  const [date, setDate] = useState(todayLocal);
  const [view, setView] = useState<ViewFilter>('all');
  const [device, setDevice] = useState('');
  const [petChoice, setPet] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [changing, setChanging] = useState<ChangeTarget | null>(null);
  useTimelineLiveRefresh();

  const devices = useTimelineDevices();
  const pets = useTimelinePets();
  const petList = pets.data ?? [];
  // A pet deleted elsewhere must not keep filtering the view to nothing.
  const pet =
    petChoice && pets.data && !petList.some(p => String(p.id) === petChoice) ? '' : petChoice;

  const query: TimelineQuery = { date, filter: serverFilter(view), device, pet };
  const list = useTimelineDay(query);
  // The unfiltered day for the same cat and device; the "Not recognised" chip counts from it.
  // It is the list query itself while no kind chip narrows the day.
  const unfiltered = useTimelineDay({ ...query, filter: 'all' });
  // The strip is the whole household's day; when no filter is set this is the same query.
  const household = useTimelineDay({ date, filter: 'all', device: '', pet: '' });

  const isToday = date === todayLocal();
  const sessions = applyViewFilter(list.data?.sessions ?? [], view);
  const keys = sessions.map((s, i) => sessionKey(s, i));
  const selectedIndex = Math.max(0, selected === null ? 0 : keys.indexOf(selected));
  const current = sessions.at(selectedIndex);
  const currentKey = keys.at(selectedIndex) ?? null;
  const deviceList = devices.data ?? [];
  const unrecognised = unfiltered.data?.sessions.filter(isUnrecognisedVisit).length;

  // Every filter change starts the list again from its newest session.
  const narrow =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setSelected(null);
    };

  let events;
  if (list.error) {
    events = (
      <ErrorBlock
        message={`The timeline could not be loaded. ${errorMessage(list.error)}`}
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    );
  } else if (list.isPending) {
    events = <Skeleton height={240} />;
  } else if (!sessions.length) {
    events = <EmptyBlock>No activity on this day.</EmptyBlock>;
  } else {
    events = (
      <TimelineEventList
        sessions={sessions}
        selectedKey={currentKey}
        onSelect={setSelected}
        showDevice={deviceList.length > 1}
        onAskWho={(s, key) => {
          setSelected(key);
          setChanging(s);
        }}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        title="Timeline"
        finding={visitSummary(household.data, isToday) ?? undefined}
        actions={<TimelineDayNav date={date} onDate={narrow(setDate)} />}
      />
      <TimelineFilterChips
        counts={list.data?.counts}
        unrecognised={unrecognised}
        view={view}
        onView={narrow(setView)}
        pets={petList}
        pet={pet}
        onPet={narrow(setPet)}
        devices={deviceList}
        device={device}
        onDevice={narrow(setDevice)}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-start gap-5 max-[900px]:grid-cols-1">
        <Card as="section" padding="none" className="px-4 py-2" aria-label="Events">
          {events}
        </Card>
        {current && (
          <TimelineSessionDetail
            key={currentKey ?? undefined}
            session={current}
            onChangeCat={setChanging}
          />
        )}
      </div>
      <TimelineDayStrip
        date={date}
        isToday={isToday}
        day={household.data}
        isLoading={household.isPending}
        error={household.error}
        onRetry={() => void household.refetch()}
        pets={petList}
        devices={deviceList}
      />
      {changing && (
        <ChangeCatDialog
          key={String(changing.id)}
          session={changing}
          pets={petList}
          onClose={() => {
            setChanging(null);
          }}
        />
      )}
    </div>
  );
}
