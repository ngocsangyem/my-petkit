import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

// Edited from the shadcn source for design-reference §3 and §6: the primary
// fill is ink, never the accent; secondary is white with a control border;
// red is either text or, for the final step-up action only, a fill. No
// resting shadow, no press translate, and the focus ring is the accent outline.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent font-sans font-medium leading-none whitespace-nowrap no-underline select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:not-disabled:bg-ink-hover hover:not-disabled:text-primary-foreground',
        outline:
          'border-input bg-secondary text-secondary-foreground hover:not-disabled:bg-muted hover:not-disabled:text-secondary-foreground aria-expanded:bg-muted',
        ghost: 'text-foreground hover:not-disabled:bg-accent aria-expanded:bg-accent',
        'destructive-text': 'text-destructive',
        destructive:
          'bg-destructive text-primary-foreground hover:not-disabled:text-primary-foreground',
        link: 'text-data hover:not-disabled:text-data-hover',
      },
      size: {
        default: 'h-8 px-3 text-base',
        sm: 'h-7 px-2.5 text-sm',
        lg: 'h-9 px-3.5 text-base',
        icon: 'size-8',
        'icon-sm': 'size-7',
      },
    },
    compoundVariants: [
      { variant: ['destructive-text', 'link'], size: ['default', 'sm', 'lg'], className: 'px-1' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
