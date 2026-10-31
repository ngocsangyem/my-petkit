import { Button, Card, Stepper } from '@/shared/ui';
import { type DeviceDetail, deviceKeys } from '../api';
import { setEntity } from '../api-calls';
import { type Command, CommandList, type CommandRunner } from '../components/command-list';
import { FigureSplit } from '../components/figure-split';
import { figureCells } from '../components/model-block';
import { FeedbackLine } from '../components/panel-parts';
import { useDeviceCall } from '../hooks/use-device-call';
import { binaryOn, findEntity, numericValue } from '../lib/entity-sections';
import { HeroArt } from './hero-card';

/** Commands that belong to "Feed now" rather than the quick actions. */
export const FEED_KEYS = ['feed', 'feed_hopper_1', 'feed_hopper_2', 'cancel_manual_feed'];

const PORTIONS = [
  { key: 'hopper1_portions', label: 'Hopper 1' },
  { key: 'hopper2_portions', label: 'Hopper 2' },
] as const;

interface FeederHeroCardProps {
  device: DeviceDetail;
  commands: readonly Command[];
  runner: CommandRunner;
}

/**
 * The top of a feeder page: the drawing with the hopper's state, and "Feed now". The portions a
 * Feed press dispenses are the feeder's own `hopperN_portions` settings, set here with steppers
 * (each step is one write, as the setting's field does); every feed asks before it runs.
 */
export function FeederHeroCard({ device, commands, runner }: FeederHeroCardProps) {
  const call = useDeviceCall();
  const feed = commands.filter(c => FEED_KEYS.includes(c.key));
  const rest = commands.filter(c => !FEED_KEYS.includes(c.key));
  const [main, ...others] = feed;
  const low = binaryOn(findEntity(device.entities, 'food_low'));
  const portions = PORTIONS.flatMap(p => {
    const e = findEntity(device.entities, p.key);
    return e ? [{ ...p, entity: e, value: numericValue(e) }] : [];
  });
  return (
    <Card
      as="section"
      aria-label={`${device.name} at a glance`}
      padding="none"
      className="flex flex-col gap-4 px-2 pt-2 pb-5"
    >
      <div className="grid gap-2 min-[901px]:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <HeroArt device={device}>
          <span className="text-sm">
            {low === null ? (
              <span className="text-muted-foreground">Food level not reported</span>
            ) : low ? (
              <span className="font-medium text-warning">Food is low</span>
            ) : (
              'Food in the hopper'
            )}
          </span>
        </HeroArt>
        <section aria-label="Feed now" className="flex min-w-0 flex-col gap-3 px-3 pt-2">
          <h2>Feed now</h2>
          {portions.map(p => (
            <div key={p.key} className="flex items-center gap-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span>{p.label}</span>
                <span className="text-xs text-muted-foreground">Portions a feed dispenses</span>
              </span>
              <Stepper
                label={`${p.label} portions`}
                value={p.value}
                min={p.entity.min ?? 0}
                max={p.entity.max ?? undefined}
                step={p.entity.step ?? 1}
                disabled={call.busy}
                onValueChange={n =>
                  void call.run(
                    () => setEntity(device.id, p.key, String(n)),
                    [deviceKeys.detail(device.id)],
                  )
                }
              />
            </div>
          ))}
          {portions.length > 0 && <FeedbackLine feedback={call.feedback} />}
          {main ? (
            <Button
              variant="primary"
              size="large"
              className="w-full"
              disabled={runner.busy}
              onClick={() => {
                runner.ask(main);
              }}
            >
              {main.name}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">This feeder takes no feed command.</p>
          )}
          {others.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {others.map(c => (
                <Button
                  key={c.key}
                  size="small"
                  disabled={runner.busy}
                  onClick={() => {
                    runner.ask(c);
                  }}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Asks before it runs. A running meal can be cancelled.
          </p>
        </section>
      </div>
      <div className="px-3">
        <CommandList commands={rest} runner={runner} />
      </div>
    </Card>
  );
}

/**
 * The feeder's figures (in the bowl, eaten, fed, hopper), which Feed now displaces from the
 * hero card; they head the right column instead. Nothing renders for a model that reports none.
 */
export function FeederFiguresCard({ device }: { device: DeviceDetail }) {
  const cells = figureCells(device, null);
  if (!cells.length) return null;
  return (
    <Card padding="none" className="p-2">
      <FigureSplit label={`${device.name} figures`} cells={cells} />
    </Card>
  );
}
