import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import enBundle from './locales/en.json' with { type: 'json' };
import esBundle from './locales/es.json' with { type: 'json' };

export type Locale = 'en' | 'es';
export type TranslationCatalog = Readonly<Record<string, string>>;
export type TranslationValues = Readonly<Record<string, string | number>>;

export interface TranslationOptions {
  /** Used if the key is missing from both the active locale and English. */
  fallback?: string;
  /** Replaces `{name}` style placeholders in the selected message. */
  values?: TranslationValues;
}

export interface LocaleOption {
  id: Locale;
  label: string;
}

export const LOCALES: readonly LocaleOption[] = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

export const DEFAULT_LOCALE: Locale = 'en';
export const DEFAULT_LOCALE_STORAGE_KEY = 'dss.locale';

const BUNDLES: Record<Locale, TranslationCatalog> = {
  en: enBundle as TranslationCatalog,
  es: esBundle as TranslationCatalog,
};

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, options?: TranslationOptions | string) => string;
}

export interface I18nProviderProps {
  children: ReactNode;
  /** Overrides browser detection and persisted locale on the initial render. */
  initialLocale?: Locale;
  storageKey?: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'es';
}

function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const language = navigator.language?.split('-')[0]?.toLowerCase();
  return isLocale(language) ? language : DEFAULT_LOCALE;
}

function readStoredLocale(storageKey: string): Locale | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(storageKey);
    return isLocale(stored) ? stored : null;
  } catch {
    // Storage can be disabled by browser privacy settings; use language detection.
    return null;
  }
}

function interpolate(message: string, values?: TranslationValues): string {
  if (!values) return message;
  return message.replace(/\{([\w.-]+)\}/g, (placeholder, name: string) => {
    const value = values[name];
    return value === undefined ? placeholder : String(value);
  });
}

export function translate(
  locale: Locale,
  key: string,
  options: TranslationOptions | string = {},
): string {
  const normalized = typeof options === 'string' ? { fallback: options } : options;
  const message = BUNDLES[locale][key] ?? BUNDLES.en[key] ?? normalized.fallback ?? key;
  return interpolate(message, normalized.values);
}

export function I18nProvider({
  children,
  initialLocale,
  storageKey = DEFAULT_LOCALE_STORAGE_KEY,
}: I18nProviderProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      if (!initialLocale) {
        const preferredLocale = readStoredLocale(storageKey) ?? detectBrowserLocale();
        if (preferredLocale !== locale) {
          setLocale(preferredLocale);
          return;
        }
      }
    }

    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem(storageKey, locale);
    } catch {
      // Locale remains active for this render even when persistence is unavailable.
    }
  }, [initialLocale, locale, storageKey]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t: (key, options) => translate(locale, key, options) }),
    [locale],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

/** Convenience hook for components that only need the translation function. */
export function useTranslation(): I18nContextValue['t'] {
  return useI18n().t;
}
