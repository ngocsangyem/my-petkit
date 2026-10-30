'use client';

import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { cn } from 'cn';

// Edited from the shadcn source for design-reference §7/§8 (v3): the iOS
// switch, 51x31 with a 27px thumb (40x24 small). On is the ink track with a
// white thumb (inverted in dark mode, like the primary button); off is a grey
// track. The focus ring is the accent outline. A disabled switch dims to 60%
// but keeps both states readable.

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
        'peer group/switch relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:outline aria-invalid:outline-destructive data-[size=default]:h-[31px] data-[size=default]:w-[51px] data-[size=sm]:h-6 data-[size=sm]:w-10 data-checked:bg-primary data-unchecked:bg-switch-off data-disabled:cursor-not-allowed data-disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full transition-transform group-data-[size=default]/switch:size-[27px] group-data-[size=sm]/switch:size-5 data-checked:bg-primary-foreground data-unchecked:bg-switch-thumb group-data-[size=default]/switch:data-checked:translate-x-5 group-data-[size=sm]/switch:data-checked:translate-x-4 data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
