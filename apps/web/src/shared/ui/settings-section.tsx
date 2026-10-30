import { useId, type ReactNode } from 'react';
import { cn } from 'cn';
import { Card } from './card-and-panel';
import { Field, FieldContent, FieldLabel } from './shadcn/field';

/** Props for {@link SettingsSection}. */
export interface SettingsSectionProps {
  /** Section heading (17/600). */
  title: string;
  /** One or two sentences in muted under the title. */
  description?: ReactNode;
  /** Rows ({@link SettingsRow}) or any content, inside the card. */
  children: ReactNode;
}

/**
 * A settings group (web-server): a white card (radius 20) with the 17/600 title and an optional
 * muted sentence, then its rows split by 1px `rule` lines. Sections stack with the page's 20px gap;
 * the `ui-settings-section` class stays as a hook for screens that place a bar before a section.
 */
export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  const headingId = useId();
  return (
    <Card
      as="section"
      className="ui-settings-section flex flex-col gap-1"
      aria-labelledby={headingId}
    >
      <div className="flex flex-col gap-1 pb-1">
        <h2 id={headingId}>{title}</h2>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

/** Attributes a {@link SettingsRow} hands to its control so it is labelled and described. */
export interface SettingsControlProps {
  id: string;
  'aria-describedby'?: string;
}

/** Props for {@link SettingsRow}. */
export interface SettingsRowProps {
  /** Setting name (500). */
  label: string;
  /** Optional 13px muted sentence: what it does and its current effect. */
  description?: ReactNode;
  /** The config key, shown in mono under the label, e.g. `proxy_block_ota`. */
  configKey?: string;
  /** Optional pill beside the label, e.g. a "Step-up" pill. */
  badge?: ReactNode;
  /** `toggle`: control at the top right (switch). `field`: a 180px control column (input, select). */
  kind?: 'toggle' | 'field';
  /** Renders the control; spread the given props onto it so the label points at it. */
  control: (props: SettingsControlProps) => ReactNode;
}

const ROW_LAYOUT = {
  toggle: 'flex flex-row items-start justify-between gap-4',
  field:
    'grid grid-cols-[minmax(0,1fr)] items-center gap-2 has-[>[data-slot=field-content]]:items-center min-[901px]:grid-cols-[minmax(0,1fr)_180px] min-[901px]:gap-4',
} as const;

/**
 * One setting inside a {@link SettingsSection} card; a row that follows another gets a 1px
 * `rule` line above it (the `ui-settings-row` class is that sibling hook).
 */
export function SettingsRow({
  label,
  description,
  configKey,
  badge,
  kind = 'toggle',
  control,
}: SettingsRowProps) {
  const id = useId();
  const descId = useId();
  const described = description !== undefined || configKey !== undefined;
  return (
    <Field
      orientation="horizontal"
      className={cn(
        'ui-settings-row min-h-13 py-2.5 [.ui-settings-row+&]:border-t [.ui-settings-row+&]:border-rule',
        ROW_LAYOUT[kind],
      )}
    >
      <FieldContent className="min-w-0 leading-(--pk-line-height)">
        <span className="flex flex-wrap items-center gap-2">
          <FieldLabel
            htmlFor={id}
            className={cn(
              'text-base leading-(--pk-line-height) font-medium select-auto',
              kind === 'toggle' && 'cursor-pointer',
            )}
          >
            {label}
          </FieldLabel>
          {badge}
        </span>
        {described && (
          <span id={descId} className="flex min-w-0 flex-col gap-0.5">
            {description !== undefined && (
              <span className="text-sm text-muted-foreground">{description}</span>
            )}
            {configKey !== undefined && (
              <span className="font-mono text-xs text-muted-foreground">{configKey}</span>
            )}
          </span>
        )}
      </FieldContent>
      {control({ id, 'aria-describedby': described ? descId : undefined })}
    </Field>
  );
}
