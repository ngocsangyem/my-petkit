import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Card, Panel } from '@/shared/ui';
import type { DeviceDetail } from '../api';
import { type Command, CommandList, type CommandRunner } from '../components/command-list';
import { DeviceArt } from '../components/device-art';
import { FigureSplit } from '../components/figure-split';
import { figureCells } from '../components/model-block';

/** "T6 · firmware 1.2.86" under a drawing; the firmware in mono. */
export function ModelCaption({ device }: { device: DeviceDetail }) {
  const { t } = useTranslation('devices');
  return (
    <span className="text-center text-xs text-muted-foreground">
      {device.type.toUpperCase()}
      {device.firmware && (
        <>
          {' '}
          <Trans
            t={t}
            i18nKey="hero.firmware"
            values={{ firmware: device.firmware }}
            components={{ mono: <span className="font-mono" /> }}
          />
        </>
      )}
    </span>
  );
}

/** The drawing on its raised panel, with the lines under it. */
export function HeroArt({ device, children }: { device: DeviceDetail; children?: ReactNode }) {
  return (
    <Panel
      padding="none"
      className="flex min-h-56 flex-col items-center justify-center gap-1.5 rounded-lg px-3 pt-4.5 pb-3.5"
    >
      <DeviceArt
        type={device.type}
        entities={device.entities}
        dual={device.schedules.some(s => s.dual)}
        size={196}
      />
      {children}
      <ModelCaption device={device} />
    </Panel>
  );
}

interface HeroCardProps {
  device: DeviceDetail;
  visitsToday: number | null;
  commands: readonly Command[];
  runner: CommandRunner;
  /** A muted line under the figures, e.g. "Values from the last report at 06:10." */
  figuresNote?: string;
  /** The muted line under the commands. */
  commandsNote?: string;
  /** A button that needs no confirmation, first in the grid (an accessory's Read now). */
  extra?: ReactNode;
}

/**
 * The top of a device page: the drawing at its real level beside the split figures, then the
 * commands as quick actions. Litter boxes, fountains and the models without an artboard use it.
 */
export function HeroCard({
  device,
  visitsToday,
  commands,
  runner,
  figuresNote,
  commandsNote,
  extra,
}: HeroCardProps) {
  const { t } = useTranslation('devices');
  const cells = figureCells(device, visitsToday);
  return (
    <Card
      as="section"
      aria-label={t('atAGlance', { name: device.name })}
      padding="none"
      className="flex flex-col gap-4 px-2 pt-2 pb-5"
    >
      <div className="grid gap-2 min-[901px]:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <HeroArt device={device} />
        <div className="flex min-w-0 flex-col gap-2">
          {cells.length > 0 ? (
            <FigureSplit
              label={t('figuresLabel', { name: device.name })}
              cells={cells}
              className="flex-1"
            />
          ) : (
            <Panel className="flex flex-1 items-center text-muted-foreground">
              {t('hero.noFigures')}
            </Panel>
          )}
          {figuresNote && <p className="mx-1.5 text-xs text-muted-foreground">{figuresNote}</p>}
        </div>
      </div>
      {(commands.length > 0 || extra) && (
        <div className="px-3">
          <CommandList commands={commands} runner={runner} note={commandsNote} extra={extra} />
        </div>
      )}
    </Card>
  );
}
