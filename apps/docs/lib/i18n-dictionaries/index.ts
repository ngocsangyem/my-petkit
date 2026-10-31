import type { Locale } from '../i18n';
import { en, type Dictionary } from './en';
import { vi } from './vi';

export type { Dictionary };

const dictionaries: Record<Locale, Dictionary> = { en, vi };

export function getDictionary(lang: Locale): Dictionary {
  return dictionaries[lang];
}
