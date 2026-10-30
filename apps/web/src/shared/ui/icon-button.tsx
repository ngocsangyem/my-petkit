import type { ComponentPropsWithRef } from 'react';
import { cn } from 'cn';
import { Icon, type IconName } from './icons';

/** Props for {@link IconButton}. */
export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  icon: IconName;
  /** Required: the button has no visible words. */
  'aria-label': string;
  /** 40px (default) or 44px (the phone bar's menu button). */
  large?: boolean;
  /** `secondary` follows the container (white on the ground, tinted in a card); `ghost` has no fill. */
  variant?: 'secondary' | 'ghost';
}

/** A round icon-only button, e.g. the phone bar's menu, a dialog's close, a stepper's minus. */
export function IconButton({
  icon,
  large,
  variant = 'secondary',
  type = 'button',
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex flex-none items-center justify-center rounded-full border-0 p-0 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
        large ? 'size-11' : 'size-10',
        variant === 'secondary'
          ? 'bg-fill-secondary hover:not-disabled:bg-active'
          : 'bg-transparent hover:not-disabled:bg-active',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={large ? 20 : 18} strokeWidth={2} />
    </button>
  );
}

/** Props for {@link QuickAction}. */
export interface QuickActionProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  icon: IconName;
  /** The visible words under the icon, e.g. "Clean". */
  label: string;
}

/**
 * A device quick action: the icon above its label on `raised`, radius 16 (design-reference §7.3:
 * a button, not decoration, and never on a hue). Lay several out in a grid.
 */
export function QuickAction({
  icon,
  label,
  type = 'button',
  className,
  ...rest
}: QuickActionProps) {
  return (
    <button
      type={type}
      className={cn(
        'flex min-w-0 flex-col items-center gap-1.5 rounded-lg border-0 bg-raised px-1 pt-3 pb-2.5 text-sm font-medium text-foreground hover:not-disabled:bg-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={18} />
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}
