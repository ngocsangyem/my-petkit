import type { ComponentPropsWithRef } from 'react';
import './button.css';

/**
 * - `primary`: ink fill, white text; at most one per screen.
 * - `secondary`: white with a control border; device commands use this.
 * - `destructive`: red text, no fill.
 * - `danger-final`: red fill; only the last action of a step-up (R3) flow.
 * - `text`: an accent text button, for Retry and in-line actions.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'danger-final' | 'text';

/** 32px by default; 28px inside table rows; 36px in dialogs and sign-in forms. */
export type ButtonSize = 'regular' | 'small' | 'large';

/** Class names for a button look, for links that must look like buttons. */
export function buttonClassName(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'regular',
  extra?: string,
): string {
  return ['ui-button', `ui-button--${variant}`, `ui-button--${size}`, extra]
    .filter(Boolean)
    .join(' ');
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
  className,
  ...rest
}: ButtonProps) {
  return <button type={type} className={buttonClassName(variant, size, className)} {...rest} />;
}
