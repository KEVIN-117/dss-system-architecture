'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  AcademicContextBadge,
  NativeSelect,
} from '@dss-monorepo/design-system/page';

/**
 * The unit a decano or director is acting on (faculty or career) and the
 * gestión on screen, shared by every panel of the portal.
 *
 * - The session only carries the IDs of the user's academic contexts, so the
 *   unit names come from the cubes the home already queries: the home
 *   publishes them here and the header badge reads them.
 * - The gestión is one choice for the whole portal, made in the header. Each
 *   panel publishes the gestiones it has data for, so the header always lists
 *   the ones the current page can show.
 */
interface AcademicScopeState {
  units: string[];
  unit: string;
  /** Gestiones the current panel has data for, oldest first. */
  years: string[];
  /** The current panel can also show every gestión at once (ALL_YEARS). */
  allowAll: boolean;
  year: string;
}

/** The "Todas las gestiones" choice, for panels that can aggregate them. */
export const ALL_YEARS = 'todas';

interface AcademicScopeValue extends AcademicScopeState {
  roleLabel: string;
  /** True inside an AcademicScopeProvider: the header owns the selectors. */
  shared: boolean;
  setUnits: (units: string[]) => void;
  setUnit: (unit: string) => void;
  setYears: (years: string[], allowAll?: boolean) => void;
  setYear: (year: string) => void;
}

const AcademicScopeContext = createContext<AcademicScopeValue | null>(null);

const EMPTY_SCOPE: AcademicScopeState = {
  units: [],
  unit: '',
  years: [],
  allowAll: false,
  year: '',
};

/** Per-tab memory of the unit names and gestión, so a reload keeps them. */
function storageKey(roleLabel: string): string {
  return `dss-academic-scope:${roleLabel}`;
}

function readStoredScope(roleLabel: string): AcademicScopeState {
  try {
    const raw = window.sessionStorage.getItem(storageKey(roleLabel));
    if (!raw) return EMPTY_SCOPE;
    const parsed = JSON.parse(raw) as Partial<AcademicScopeState>;
    return {
      units: Array.isArray(parsed.units)
        ? parsed.units.filter((unit) => typeof unit === 'string')
        : [],
      unit: typeof parsed.unit === 'string' ? parsed.unit : '',
      // The year list belongs to the page on screen; the panel publishes it again.
      years: [],
      allowAll: false,
      year: typeof parsed.year === 'string' ? parsed.year : '',
    };
  } catch {
    return EMPTY_SCOPE;
  }
}

/** State and setters, shared by the provider and the local fallback. */
function useScopeState(initial: AcademicScopeState) {
  const [state, setState] = useState<AcademicScopeState>(initial);

  const setUnits = useCallback(
    (units: string[]) =>
      setState((current) => ({
        ...current,
        units,
        unit: units.includes(current.unit) ? current.unit : (units[0] ?? ''),
      })),
    [],
  );
  const setUnit = useCallback(
    (unit: string) => setState((current) => ({ ...current, unit })),
    [],
  );
  const setYears = useCallback(
    (years: string[], allowAll = false) =>
      setState((current) =>
        current.allowAll === allowAll &&
        current.years.length === years.length &&
        current.years.every((year, index) => year === years[index])
          ? current
          : { ...current, years, allowAll },
      ),
    [],
  );
  const setYear = useCallback(
    (year: string) =>
      setState((current) =>
        current.year === year ? current : { ...current, year },
      ),
    [],
  );

  return { state, setState, setUnits, setUnit, setYears, setYear };
}

export function AcademicScopeProvider({
  roleLabel,
  children,
}: {
  roleLabel: string;
  children: ReactNode;
}) {
  const { state, setState, setUnits, setUnit, setYears, setYear } =
    useScopeState(EMPTY_SCOPE);

  // Restore after mount (not during render) so server and client markup match.
  useEffect(() => {
    setState((current) =>
      current.units.length || current.year
        ? current
        : readStoredScope(roleLabel),
    );
  }, [roleLabel, setState]);
  useEffect(() => {
    if (!state.units.length && !state.year) return;
    try {
      window.sessionStorage.setItem(
        storageKey(roleLabel),
        JSON.stringify({
          units: state.units,
          unit: state.unit,
          year: state.year,
        }),
      );
    } catch {
      // Storage can be unavailable (private mode); the panels then pick a default.
    }
  }, [state, roleLabel]);

  const value = useMemo(
    () => ({
      ...state,
      roleLabel,
      shared: true,
      setUnits,
      setUnit,
      setYears,
      setYear,
    }),
    [state, roleLabel, setUnits, setUnit, setYears, setYear],
  );
  return (
    <AcademicScopeContext.Provider value={value}>
      {children}
    </AcademicScopeContext.Provider>
  );
}

/**
 * Unit and gestión selection. Inside an AcademicScopeProvider it is shared
 * with the header; without one it falls back to local state, so the panels
 * keep their own selectors in portals that do not provide a scope yet.
 */
export function useAcademicScope(): AcademicScopeValue {
  const shared = useContext(AcademicScopeContext);
  const local = useScopeState(EMPTY_SCOPE);
  return (
    shared ?? {
      ...local.state,
      roleLabel: '',
      shared: false,
      setUnits: local.setUnits,
      setUnit: local.setUnit,
      setYears: local.setYears,
      setYear: local.setYear,
    }
  );
}

/**
 * The gestión a panel should show: the global choice when the panel has data
 * for it, otherwise `fallback` (usually the latest gestión with data). Panels
 * publish their gestiones and keep the global choice valid.
 */
export function useScopeYear(
  available: string[],
  fallback: string,
  { allowAll = false }: { allowAll?: boolean } = {},
): { year: string; requested: string; setYear: (year: string) => void } {
  const scope = useAcademicScope();
  const { setYears, setYear, year: requested } = scope;

  useEffect(() => {
    setYears(available, allowAll);
  }, [available, allowAll, setYears]);
  // Clear the list when the panel leaves, so the header never offers a
  // previous page's gestiones.
  useEffect(() => () => setYears([]), [setYears]);

  const valid =
    available.includes(requested) || (allowAll && requested === ALL_YEARS);
  useEffect(() => {
    if (!valid && fallback) setYear(fallback);
  }, [valid, fallback, setYear]);

  return {
    year: valid ? requested : fallback,
    requested,
    setYear,
  };
}

/** "Ingeniería de Sistemas" → "Sistemas", for the badge on narrow screens. */
function shortUnit(unit: string): string {
  return unit.replace(
    /^(Facultad|Ingeniería|Licenciatura|Carrera)\s+(de|en)\s+/i,
    '',
  );
}

/**
 * Header badge with the role and unit. It stays hidden until the home has
 * resolved the unit names, and becomes a selector when the user governs
 * several units.
 */
export function AcademicScopeBadge({
  showYear = true,
}: {
  showYear?: boolean;
}) {
  const scope = useContext(AcademicScopeContext);
  if (!scope || !scope.unit) return null;
  return (
    <AcademicContextBadge
      roleLabel={scope.roleLabel}
      contexts={scope.units.map((unit) => ({
        id: unit,
        unit,
        shortUnit: shortUnit(unit),
      }))}
      currentId={scope.unit}
      gestion={showYear ? scope.year || undefined : undefined}
      onContextChange={scope.units.length > 1 ? scope.setUnit : undefined}
    />
  );
}

/**
 * Header controls of the portal: where the user is acting (badge) and the
 * one gestión every panel shows. The selector lists the gestiones of the
 * current page and is hidden while a page has not published them.
 *
 * `badge`: `always` (director), `multiple` (only when the user governs
 * several units, e.g. a decano of two faculties) or `never` (rector).
 */
export function AcademicScopeHeader({
  badge = 'always',
}: {
  badge?: 'always' | 'multiple' | 'never';
}) {
  const scope = useContext(AcademicScopeContext);
  if (!scope) return null;
  const years = [...scope.years].reverse();
  const options = [
    ...(scope.allowAll && years.length
      ? [{ value: ALL_YEARS, label: 'Todas las gestiones' }]
      : []),
    ...years.map((year) => ({ value: year, label: `Gestión ${year}` })),
  ];
  const showBadge =
    badge === 'always' || (badge === 'multiple' && scope.units.length > 1);
  return (
    <div className="flex min-w-0 items-center gap-2">
      {showBadge ? <AcademicScopeBadge showYear={false} /> : null}
      {years.length ? (
        <NativeSelect
          label="Gestión académica"
          hideLabel
          value={
            options.some((option) => option.value === scope.year)
              ? scope.year
              : ''
          }
          onChange={(event) => scope.setYear(event.currentTarget.value)}
          options={options}
          containerClassName="shrink-0"
          className="h-9 min-w-0 rounded-full border-(--glass-border) bg-(--glass-track) pr-8 pl-3 text-xs font-semibold text-foreground hover:border-ring/50"
        />
      ) : null}
    </div>
  );
}
