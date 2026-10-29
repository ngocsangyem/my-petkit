import * as React from 'react';
import { cn } from 'cn';

// Edited from the shadcn source: the accent focus outline instead of a ring
// (design-reference §2), and form controls at radius 6 on the surface colour.

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-background px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive dark:disabled:bg-input/80',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
