'use client';

import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { cn } from 'cn';

// Edited from the shadcn source: the accent focus outline instead of a ring
// (design-reference §2), and form controls at radius 6 on the surface colour. A disabled switch
// is not faded (an off one vanished on a raised panel): off is a hollow track with a muted edge
// and thumb, on is a muted track instead of ink.

function Switch({
  className,
  size = 'default',
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: 'sm' | 'default';
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors outline-none group-has-[:focus-visible]/field-label:border-transparent group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:data-checked:bg-muted-foreground data-disabled:data-unchecked:border-muted-foreground/50 data-disabled:data-unchecked:bg-transparent dark:data-disabled:data-unchecked:bg-transparent',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] dark:data-checked:bg-primary-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 dark:data-unchecked:bg-foreground group-data-disabled/switch:data-unchecked:bg-muted-foreground/50 dark:group-data-disabled/switch:data-unchecked:bg-muted-foreground/60"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
