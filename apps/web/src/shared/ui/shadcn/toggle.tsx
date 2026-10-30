'use client';

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

// Edited from the shadcn source for design-reference §8 (web v3):
// - `outline` is the chip: a 36px pill on `--pk-fill-secondary` (white on the
//   ground, ground-tinted inside a card); pressed, it fills with ink and
//   inverts in dark mode, like the primary button (§8.4).
// - `segment` is one choice of a segmented control: the track is drawn by the
//   group (`segment` on `--pk-segment`), the pressed choice is a white pill.
// The focus ring is the accent outline.
const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:outline aria-invalid:outline-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-transparent hover:not-disabled:bg-active',
        outline:
          'bg-fill-secondary hover:not-disabled:bg-active aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:not-disabled:bg-primary',
        segment:
          'flex-1 text-lede aria-pressed:bg-background aria-pressed:font-semibold aria-pressed:text-foreground',
      },
      size: {
        default: 'h-(--pk-chip-height) min-w-9 px-3.5 text-base',
        sm: "h-(--pk-control-height-small) min-w-8 px-3 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-(--pk-control-height) min-w-10 px-4 text-base',
      },
    },
    compoundVariants: [{ variant: 'segment', className: 'h-8 px-3' }],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Toggle({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
