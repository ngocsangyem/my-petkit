import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

// Edited from the shadcn source for design-reference §8 (web v3): every
// button is a full pill. The primary fill is ink, never the accent; secondary
// takes `--pk-fill-secondary` (white on the ground, ground-tinted inside a card
// or dialog, set by those containers); red is either text or, for the final
// step-up action only, a fill. No resting shadow, no press translate, and the
// focus ring is the accent outline. Heights: 40 regular, 32 small, 48 for the
// main action of a form.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-0 font-sans font-semibold leading-none whitespace-nowrap no-underline select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:outline-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:not-disabled:bg-ink-hover hover:not-disabled:text-primary-foreground',
        outline:
          'bg-fill-secondary text-foreground hover:not-disabled:bg-active hover:not-disabled:text-foreground aria-expanded:bg-active',
        ghost:
          'bg-transparent text-foreground hover:not-disabled:bg-active aria-expanded:bg-active',
        'destructive-text': 'bg-transparent text-destructive hover:not-disabled:bg-active',
        destructive:
          'bg-destructive text-primary-foreground hover:not-disabled:text-primary-foreground',
        link: 'bg-transparent font-medium text-data hover:not-disabled:text-data-hover',
      },
      size: {
        default: 'h-(--pk-control-height) px-[18px] text-base',
        sm: 'h-(--pk-control-height-small) px-3.5 text-sm',
        lg: 'h-(--pk-control-height-large) px-6 text-md',
        icon: 'size-(--pk-control-height)',
        'icon-sm': 'size-(--pk-control-height-small)',
      },
    },
    compoundVariants: [
      { variant: 'link', size: ['default', 'sm', 'lg'], className: 'h-auto min-h-6 px-1' },
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
