import { useState } from 'react';
import { errorMessage } from '@/shared/api/errors';
import { EmptyBlock, ErrorBlock, FigureContainer, PageHeading, Skeleton } from '@/shared/ui';
import { useTimelineDay, useTimelineDevices, useTimelinePets, type TimelineQuery } from './api';
import { TimelineDayStrip } from './components/timeline-day-strip';
import { TimelineEventList } from './components/timeline-event-list';
import { TimelineFilterChips } from './components/timeline-filter-chips';
import { TimelineSessionDetail } from './components/timeline-session-detail';
import { TimelineToolbar } from './components/timeline-toolbar';
import { useTimelineLiveRefresh } from './hooks/use-timeline-live-refresh';
import { sessionKey, todayLocal, type FilterKey, type TimelineDay } from './timeline-model';
import { visitSummary } from './timeline-summary';

function figures(day: TimelineDay | undefined) {
  const c = day?.counts;
  return [
    { id: 'visits', label: 'Litter-box visits', value: c?.toileting },
    { id: 'pet', label: 'Pet sightings', value: c?.pet },
    { id: 'feeding', label: 'Feedings', value: c?.feeding },
    { id: 'cleaning', label: 'Cleanings', value: c?.cleaning },
  ];
}

/** One local day: the household strip, the day's figures, and every session with its media. */
export function TimelinePage() {
  const [date, setDate] = useState(todayLocal);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [device, setDevice] = useState('');
  const [petChoice, setPet] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  useTimelineLiveRefresh();

  const devices = useTimelineDevices();
  const pets = useTimelinePets();
  const petList = pets.data ?? [];
  // A pet deleted elsewhere must not keep filtering the view to nothing.
  const pet =
    petChoice && pets.data && !petList.some(p => String(p.id) === petChoice) ? '' : petChoice;

  const query: TimelineQuery = { date, filter, device, pet };
  const list = useTimelineDay(query);
  // The strip is the whole household's day; when no filter is set this is the same query.
  const household = useTimelineDay({ date, filter: 'all', device: '', pet: '' });

  const isToday = date === todayLocal();
  const sessions = list.data?.sessions ?? [];
  const keys = sessions.map((s, i) => sessionKey(s, i));
  const selectedIndex = Math.max(0, selected === null ? 0 : keys.indexOf(selected));
  const current = sessions.at(selectedIndex);
  const currentKey = keys.at(selectedIndex) ?? null;
  const deviceList = devices.data ?? [];

  const changeDay = (next: string) => {
    setDate(next);
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
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-(--pk-gap)">
      <PageHeading title="Timeline" aside={visitSummary(household.data, isToday) ?? undefined} />
      <TimelineToolbar
        date={date}
        onDate={changeDay}
        pet={pet}
        onPet={v => {
          setPet(v);
          setSelected(null);
        }}
        device={device}
        onDevice={v => {
          setDevice(v);
          setSelected(null);
        }}
        pets={petList}
        devices={deviceList}
      />
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
      {list.isPending ? (
        <Skeleton height={84} />
      ) : (
        <FigureContainer label="The day in figures" cells={figures(list.data)} />
      )}
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-(--pk-gap) max-[900px]:grid-cols-1">
        <section className="flex min-w-0 flex-col gap-2" aria-labelledby="tl-events-h">
          <div className="flex flex-col gap-2">
            <h2 id="tl-events-h" className="m-0 text-lg font-semibold">
              Events
            </h2>
            <TimelineFilterChips
              counts={list.data?.counts}
              value={filter}
              onChange={k => {
                setFilter(k);
                setSelected(null);
              }}
            />
          </div>
          {events}
        </section>
        {current && (
          <TimelineSessionDetail key={currentKey ?? undefined} session={current} pets={petList} />
        )}
      </div>
    </div>
  );
}
