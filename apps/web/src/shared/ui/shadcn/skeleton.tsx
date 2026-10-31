import { cn } from 'cn';

// Edited from the shadcn source: a flat grey bar at the final size, no pulse
// (DESIGN.md: no shimmer), on `raised` at radius 8 (web-states).

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('rounded-sm bg-raised', className)} {...props} />;
}

export { Skeleton };
