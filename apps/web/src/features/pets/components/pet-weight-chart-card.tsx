import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Segmented, Skeleton } from '@/shared/ui';
import {
  shortDate,
  weightPoints,
  weightScale,
  weightTrendText,
  type PetDay,
  type WeightRange,
} from '../pet-history-model';
import { gramsToKgText } from '../pet-weight-model';

/** The plotted area in viewBox units; the SVG is stretched to the card, so text is never in it. */
const W = 600;
const H = 160;
const TOP = 16;
const BOTTOM = 16;

interface ChartProps {
  points: readonly { date: string; grams: number }[];
  /** Every calendar day of the span, oldest first: the axis the dates under the chart name. */
  span: readonly string[];
  label: string;
}

/** A thin line over three rules, the latest reading as a dot, the kilograms on the right. */
function WeightLine({ points, span, label }: ChartProps) {
  const { min, max } = weightScale(points);
  const y = (grams: number) => TOP + (1 - (grams - min) / (max - min)) * (H - TOP - BOTTOM);
  // Placed by calendar day, not by reading: a day with no weighed visit keeps its width, so the
  // line lines up with the dates under it.
  const x = (i: number) => {
    const day = span.indexOf(points.at(i)?.date ?? '');
    return span.length < 2 || day < 0 ? W / 2 : (day / (span.length - 1)) * W;
  };
  const last = points.at(-1);
  const ticks = [max, (max + min) / 2, min].map(g => ({ g, top: (y(g) / H) * 100 }));
  return (
    <div className="relative h-40" role="img" aria-label={label}>
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
        aria-hidden="true"
      >
        {ticks.map(t => (
          <line
            key={t.g}
            x1={0}
            x2={W}
            y1={y(t.g)}
            y2={y(t.g)}
            className="stroke-rule"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {points.length > 1 && (
          <polyline
            points={points.map((p, i) => `${String(x(i))},${String(y(p.grams))}`).join(' ')}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            className="stroke-data"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {last && (
        <span
          className="absolute size-2 -translate-1/2 rounded-full bg-data"
          style={{
            left: `${String((x(points.length - 1) / W) * 100)}%`,
            top: `${String((y(last.grams) / H) * 100)}%`,
          }}
          aria-hidden="true"
        />
      )}
      {ticks.map(t => (
        <span
          key={t.g}
          className="absolute right-0 -translate-y-full pb-0.5 text-xs text-muted-foreground tabular-nums"
          style={{ top: `${String(t.top)}%` }}
          aria-hidden="true"
        >
          {gramsToKgText(t.g)}
        </span>
      ))}
    </div>
  );
}

export interface PetWeightChartCardProps {
  name: string;
  days: readonly PetDay[];
  /** The registered weight, shown as the figure until a visit is weighed. */
  registeredG: number | null;
  isPending: boolean;
}

/**
 * "Weight": the latest weighed reading as the figure, its change over the span, and the line of
 * daily readings over one or two weeks. A day with no weighed visit leaves a gap in the data,
 * never a guessed point.
 */
export function PetWeightChartCard({
  name,
  days,
  registeredG,
  isPending,
}: PetWeightChartCardProps) {
  const { t } = useTranslation('pets');
  const [range, setRange] = useState<WeightRange>(14);
  const ranges = [
    { id: '7', label: t('chart.week') },
    { id: '14', label: t('chart.twoWeeks') },
  ] as const;
  const headingId = useId();
  const points = weightPoints(days, range);
  const figure = points.at(-1)?.grams ?? registeredG;
  const trend = weightTrendText(points, range);
  const shown = days.slice(-range);
  const dates = [shown[0], shown[Math.floor(shown.length / 2)], shown.at(-1)];

  let chart;
  if (isPending) {
    chart = <Skeleton height={160} />;
  } else if (!points.length) {
    chart = (
      <p className="flex h-40 items-center justify-center rounded-md bg-raised px-4 text-center text-sm text-muted-foreground">
        {t('chart.noWeighed', { name })}
      </p>
    );
  } else {
    chart = (
      <WeightLine
        points={points}
        span={shown.map(d => d.date)}
        label={t('chart.label', {
          name,
          days: range,
          list: points.map(p => `${shortDate(p.date)} ${gramsToKgText(p.grams)} kg`).join(', '),
        })}
      />
    );
  }

  return (
    <Card as="section" aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col">
          <span id={headingId} className="text-sm text-muted-foreground">
            {t('chart.title')}
          </span>
          <span className="tabular-nums">
            <b className="text-3xl font-medium">{figure === null ? '—' : gramsToKgText(figure)}</b>
            <span className="ml-0.5 text-md text-muted-foreground">kg</span>
          </span>
          <span className="text-sm text-muted-foreground">
            {trend ?? (points.length ? t('chart.oneDay') : t('chart.registered'))}
          </span>
        </div>
        <div className="w-50">
          <Segmented
            label={t('chart.span')}
            options={ranges}
            value={String(range) as '7' | '14'}
            onChange={id => {
              setRange(Number(id) as WeightRange);
            }}
          />
        </div>
      </div>
      {chart}
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
        {dates.map((d, i) => (
          <span key={`${String(i)}-${d?.date ?? ''}`}>{d ? shortDate(d.date) : ''}</span>
        ))}
      </div>
    </Card>
  );
}
