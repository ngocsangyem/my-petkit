import type { ComponentPropsWithRef } from 'react';
import { Button as ShadcnButton, buttonVariants } from './shadcn/button';

/**
 * Every button is a full pill.
 * - `primary`: near-black fill, white text (inverted in dark mode); at most one per screen.
 * - `secondary`: white on the ground, ground-tinted inside a card or dialog, white again inside a
 *   raised `Panel`; device commands use this.
 * - `ghost`: no fill until hovered, e.g. a toast or toolbar action.
 * - `destructive`: red text, no fill (Revoke, Sign out).
 * - `danger-final`: red fill; only the last action of a step-up (R3) flow.
 * - `text`: an accent text link-button, for in-line actions.
 */
export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'destructive' | 'danger-final' | 'text';

/** 40px by default; 32px inside table rows and toolbars; 48px for the main action of a form. */
export type ButtonSize = 'regular' | 'small' | 'large';

const VARIANT = {
  primary: 'default',
  secondary: 'outline',
  ghost: 'ghost',
  destructive: 'destructive-text',
  'danger-final': 'destructive',
  text: 'link',
} as const satisfies Record<ButtonVariant, string>;

const SIZE = { regular: 'default', small: 'sm', large: 'lg' } as const satisfies Record<
  ButtonSize,
  string
>;

/** Class names for a button look, for links that must look like buttons. */
export function buttonClassName(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'regular',
  extra?: string,
): string {
  return buttonVariants({ variant: VARIANT[variant], size: SIZE[size], className: extra });
}

/** Props for {@link Button}: every native button prop plus the look. */
export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** A real `<button>`, `type="button"` unless told otherwise; use `disabled`, never a fake class. */
export function Button({
  variant = 'secondary',
  size = 'regular',
  type = 'button',
  ...rest
}: ButtonProps) {
  return <ShadcnButton type={type} variant={VARIANT[variant]} size={SIZE[size]} {...rest} />;
}
