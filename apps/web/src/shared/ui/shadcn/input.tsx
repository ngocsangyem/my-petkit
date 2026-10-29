import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';
import { cn } from 'cn';

// Edited from the shadcn source: the accent focus outline instead of a ring
// (design-reference §2), and form controls at radius 6 on the surface colour.

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'h-8 w-full min-w-0 rounded-md border border-input bg-background dark:bg-raised px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive dark:disabled:bg-input/80',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
