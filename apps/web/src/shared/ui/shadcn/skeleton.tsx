import { cn } from 'cn';

// Edited from the shadcn source: a flat grey bar at the final size, no pulse
// (design-reference §3: no shimmer).

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('rounded-sm bg-active', className)} {...props} />;
}

export { Skeleton };
