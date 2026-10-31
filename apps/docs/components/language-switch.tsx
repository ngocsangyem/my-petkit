'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentProps } from 'react';
import { Check, Globe } from 'lucide-react';
import { buttonVariants, type ButtonProps } from 'fumadocs-ui/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from 'fumadocs-ui/components/ui/popover';
import { cn } from '@/lib/cn';
import { i18n, localeFromPathname, localeLabels, switchLocalePath } from '@/lib/i18n';

type LanguageSwitchProps = ComponentProps<'button'> & { variant?: ButtonProps['variant'] };

/**
 * Globe button showing the current language code; the menu links to the same page in each
 * language. Language names are always written in their own language. The layout's own
 * children (icon, label, chevron) are replaced so the button reads the same everywhere.
 */
export function LanguageSwitch({ className, variant = 'ghost', children: _children, ...rest }: LanguageSwitchProps) {
  const pathname = usePathname();
  const current = localeFromPathname(pathname);
  const label = localeLabels[current].menuLabel;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className={(s) => cn(buttonVariants({ variant }), 'gap-1.5 p-1.5 font-mono text-xs', s.open && 'bg-fd-accent', className)}
        {...rest}
      >
        <Globe className="size-4.5 shrink-0" aria-hidden />
        <span>{localeLabels[current].code}</span>
      </PopoverTrigger>
      <PopoverContent className="flex flex-col gap-0.5 p-1 min-w-[200px] w-auto" aria-label={label}>
        {i18n.languages.map((lang) => {
          const active = lang === current;
          return (
            <Link
              key={lang}
              href={switchLocalePath(pathname, lang)}
              hrefLang={lang}
              lang={lang}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex items-center gap-3 px-2 py-2 text-sm rounded-lg transition-colors',
                active
                  ? 'bg-fd-primary/10 text-fd-primary'
                  : 'text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground',
              )}
            >
              <span className="w-6 font-mono text-xs font-medium">{localeLabels[lang].code}</span>
              <span className="flex-1">{localeLabels[lang].name}</span>
              {active && <Check className="size-4" aria-hidden />}
            </Link>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/** Required by the layouts' slot shape; the button already shows the code. */
export function LanguageSwitchText(props: ComponentProps<'span'>) {
  const current = localeFromPathname(usePathname());
  return <span {...props}>{localeLabels[current].code}</span>;
}
