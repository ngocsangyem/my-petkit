import * as React from 'react';
import { cn } from 'cn';

// Edited from the shadcn source for design-reference §8 (web v3): borderless,
// radius 14 on `--pk-fill-field`, the accent focus outline instead of a ring.

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border-0 bg-fill-field px-3.5 py-2.5 text-md transition-colors outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:outline aria-invalid:outline-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
