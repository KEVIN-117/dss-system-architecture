# Shared i18n

React translation context for the monorepo, with English (`en`) and Spanish (`es`) bundles migrated from Saiku.

Wrap the app once with `I18nProvider`, then use `useI18n()` for the current locale, locale setter, and translator:

```tsx
<I18nProvider>
  <App />
</I18nProvider>
```

```tsx
const { locale, setLocale, t } = useI18n();
t('topbar.language');
t('dashboard.bulk.selected', { values: { n: 3 } });
```

The provider chooses a supported saved locale, then the browser language, and defaults to English. It persists under `dss.locale` and updates the document language. Missing Spanish keys fall back to English; unknown keys use a supplied fallback or display the key.
