import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';
import { cn } from 'cn';

// Edited from the shadcn source for design-reference §8 (web v3): borderless
// 44px fields at radius 14 on `--pk-fill-field` (white on the ground, raised
// inside a card or dialog, white inside a raised panel), 15px text, the accent
// focus outline instead of a ring, and a 1px red outline when invalid.

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'h-(--pk-field-height) w-full min-w-0 rounded-md border-0 bg-fill-field px-3.5 py-1 text-md transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-60 aria-invalid:outline aria-invalid:outline-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
