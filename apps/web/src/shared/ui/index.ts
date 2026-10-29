// Public surface of the shared UI layer. Importing it loads the fonts, the
// tokens and the global base styles once.
import './theme.css';
import './global.css';

export { Button, buttonClassName } from './button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './button';
export { CollapsiblePanel } from './collapsible-panel';
export type { CollapsiblePanelProps } from './collapsible-panel';
export { ConfirmDialog } from './confirm-dialog';
export type { ConfirmDialogProps } from './confirm-dialog';
export {
  clampMinute,
  formatMinute,
  leftAt,
  MINUTES_PER_DAY,
  minuteToPercent,
  spanAt,
} from './day-strip-geometry';
export { DrumMark } from './drum-mark';
export type { DrumMarkProps } from './drum-mark';
export { FigureContainer } from './figure-container';
export type { FigureCell, FigureContainerProps } from './figure-container';
export {
  InlineField,
  NumberInput,
  parseNumberInput,
  SearchField,
  Select,
  StackedField,
  Switch,
  TextInput,
  TimeInput,
} from './form-controls';
export type {
  InlineFieldProps,
  NumberInputProps,
  SearchFieldProps,
  SelectOption,
  SelectProps,
  StackedFieldProps,
  SwitchProps,
  TextInputProps,
  TimeInputProps,
} from './form-controls';
export { DayStripLegend, HouseholdDayStrip, PET_TINT_COUNT, petSlot } from './household-day-strip';
export type {
  DayStripLane,
  DayStripMeal,
  DayStripSpan,
  DayStripVisit,
  HouseholdDayStripProps,
} from './household-day-strip';
export { Icon } from './icons';
export type { IconName, IconProps } from './icons';
export { PageHeading } from './page-heading';
export type { PageHeadingProps } from './page-heading';
export { usePersistedState } from './persisted-state';
export { Pill } from './pill';
export type { PillProps, PillTone } from './pill';
export { RatioBar, ratioPercent } from './ratio-bar';
export type { RatioBarProps, RatioTone } from './ratio-bar';
export { SectionCard } from './section-card';
export type { SectionCardProps } from './section-card';
export { SettingsRow, SettingsSection } from './settings-section';
export type {
  SettingsControlProps,
  SettingsRowProps,
  SettingsSectionProps,
} from './settings-section';
export { EmptyBlock, ErrorBlock, isMissing, Missing, Skeleton, ValueText } from './state-blocks';
export type { EmptyBlockProps, ErrorBlockProps, MaybeValue, SkeletonProps } from './state-blocks';
export { LiveIndicator, StatusMark, statusLabel } from './status-mark';
export type { DeviceStatus, LiveIndicatorProps, LiveState, StatusMarkProps } from './status-mark';
export { RiskNotice, StepUpPill } from './step-up';
export type { RiskNoticeProps, StepUpPillProps } from './step-up';
export { LogLevelText, Table } from './table';
export type { LogLevel, LogLevelTextProps, TableColumn, TableProps } from './table';
export { SegmentedChips, Tabs } from './tabs';
export type { SegmentedChipsProps, TabItem, TabsProps } from './tabs';
export { ThemeModeControl, useThemeMode } from './theme-mode';
export type { ThemeMode } from './theme-mode';
export { ToastProvider, useToast } from './toast';
export { useModalFocus } from './use-modal-focus';
export type { ModalFocusOptions } from './use-modal-focus';
