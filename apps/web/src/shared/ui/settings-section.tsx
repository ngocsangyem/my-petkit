import { useId, type ReactNode } from 'react';
import './settings-section.css';

/** Props for {@link SettingsSection}. */
export interface SettingsSectionProps {
  /** Section heading (16/500). */
  title: string;
  /** One or two sentences in muted under the title. */
  description?: ReactNode;
  /** Rows ({@link SettingsRow}) or any content; sits on a `raised` panel. */
  children: ReactNode;
}

/** A settings group: a 360px label column, then a `raised` panel; sections are split by a rule. */
export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  const headingId = useId();
  return (
    <section className="ui-settings-section" aria-labelledby={headingId}>
      <div className="ui-settings-section__intro">
        <h2 id={headingId} className="ui-settings-section__title">
          {title}
        </h2>
        {description && <p className="ui-settings-section__description">{description}</p>}
      </div>
      <div className="ui-settings-section__panel">{children}</div>
    </section>
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

/** One setting inside a {@link SettingsSection} panel. */
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
    <div className={`ui-settings-row ui-settings-row--${kind}`}>
      <span className="ui-settings-row__text">
        <span className="ui-settings-row__head">
          <label htmlFor={id} className="ui-settings-row__label">
            {label}
          </label>
          {badge}
        </span>
        {described && (
          <span id={descId} className="ui-settings-row__meta">
            {description !== undefined && (
              <span className="ui-settings-row__description">{description}</span>
            )}
            {configKey !== undefined && <span className="ui-settings-row__key">{configKey}</span>}
          </span>
        )}
      </span>
      {control({ id, 'aria-describedby': described ? descId : undefined })}
    </div>
  );
}
