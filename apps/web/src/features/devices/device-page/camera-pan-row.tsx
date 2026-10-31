import { cn } from 'cn';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n';
import { Button } from '@/shared/ui';
import type { Command, CommandRunner } from '../components/command-list';

/** The camera-pan buttons a T6 publishes once its pan patch is on (`pan_left`, …). */
export const isPanCommand = (c: Command) => c.key.startsWith('pan_');

const ORDER = ['pan_left', 'pan_home', 'pan_right'];

/** The short word on a known pan button, in the active language. */
function panWord(key: string): string | undefined {
  switch (key) {
    case 'pan_left':
      return i18n.t('devices:pan.left');
    case 'pan_home':
      return i18n.t('devices:pan.home');
    case 'pan_right':
      return i18n.t('devices:pan.right');
    default:
      return undefined;
  }
}

/** Pan commands left to right, each with its short word; unknown pan keys keep their name. */
export function panButtons(commands: readonly Command[]) {
  return [...commands]
    .sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))
    .map(c => ({ command: c, word: panWord(c.key) ?? c.name }));
}

interface CameraPanRowProps {
  commands: readonly Command[];
  runner: CommandRunner;
  /** Buttons on the live view's dark bar instead of a settings row. */
  className?: string;
  buttonClassName?: string;
}

/** "Camera: Left · Home · Right". Each move asks before it runs, as every command does. */
export function CameraPanRow({ commands, runner, className, buttonClassName }: CameraPanRowProps) {
  const { t } = useTranslation('devices');
  return (
    <div
      role="group"
      aria-label={t('pan.camera')}
      className={cn(
        'flex min-h-13 flex-wrap items-center gap-3 border-t border-rule py-2',
        className,
      )}
    >
      <span className="flex-1">{t('pan.camera')}</span>
      <span className="flex flex-wrap gap-2">
        {panButtons(commands).map(({ command, word }) => (
          <Button
            key={command.key}
            size="small"
            className={buttonClassName}
            aria-label={command.name}
            disabled={runner.busy}
            onClick={() => {
              runner.ask(command);
            }}
          >
            {word}
          </Button>
        ))}
      </span>
    </div>
  );
}
