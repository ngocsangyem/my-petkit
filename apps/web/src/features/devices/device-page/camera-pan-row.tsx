import { cn } from 'cn';
import { Button } from '@/shared/ui';
import type { Command, CommandRunner } from '../components/command-list';

/** The camera-pan buttons a T6 publishes once its pan patch is on (`pan_left`, …). */
export const isPanCommand = (c: Command) => c.key.startsWith('pan_');

const ORDER = ['pan_left', 'pan_home', 'pan_right'];
const WORD: Readonly<Record<string, string>> = {
  pan_left: 'Left',
  pan_home: 'Home',
  pan_right: 'Right',
};

/** Pan commands left to right, each with its short word; unknown pan keys keep their name. */
export function panButtons(commands: readonly Command[]) {
  return [...commands]
    .sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))
    .map(c => ({ command: c, word: WORD[c.key] ?? c.name }));
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
  return (
    <div
      role="group"
      aria-label="Camera"
      className={cn(
        'flex min-h-13 flex-wrap items-center gap-3 border-t border-rule py-2',
        className,
      )}
    >
      <span className="flex-1">Camera</span>
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
