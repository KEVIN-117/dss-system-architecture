'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
} from 'react';

export type AsyncResourceStatus =
  | 'idle'
  | 'loading'
  | 'refreshing'
  | 'error'
  | 'success';

export interface AsyncResourceOptions {
  /** When false the loader does not run and status stays `idle`. */
  enabled?: boolean;
  /** Keep the last data visible while a new request runs (`refreshing`). */
  keepPreviousData?: boolean;
}

export interface AsyncResource<T> {
  data: T | undefined;
  error: unknown;
  status: AsyncResourceStatus;
  /** First load with nothing to show yet: render skeletons. */
  isLoading: boolean;
  /** New request while previous data is still on screen: dim and show progress. */
  isRefreshing: boolean;
  /** Runs the loader again with the same dependencies. */
  retry: () => void;
}

interface State<T> {
  data: T | undefined;
  error: unknown;
  status: AsyncResourceStatus;
}

/**
 * Replaces the hand-written `useState` + `useEffect` + `active` flag pattern.
 * Every run gets an AbortSignal; a stale response (deps changed, unmount,
 * retry) is aborted and never reaches state, so fast filter changes can't race.
 */
export function useAsyncResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  { enabled = true, keepPreviousData = true }: AsyncResourceOptions = {},
): AsyncResource<T> {
  const [state, setState] = useState<State<T>>({
    data: undefined,
    error: undefined,
    status: enabled ? 'loading' : 'idle',
  });
  const [attempt, setAttempt] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (!enabled) {
      setState((current) => ({ ...current, status: 'idle' }));
      return;
    }

    const controller = new AbortController();
    setState((current) => {
      const keep = keepPreviousData && current.data !== undefined;
      return {
        data: keep ? current.data : undefined,
        error: undefined,
        status: keep ? 'refreshing' : 'loading',
      };
    });

    loaderRef.current(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setState({ data, error: undefined, status: 'success' });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState((current) => ({
          data: keepPreviousData ? current.data : undefined,
          error,
          status: 'error',
        }));
      },
    );

    return () => controller.abort();
    // The caller owns the dependency list, like useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt, enabled, keepPreviousData]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    ...state,
    isLoading: state.status === 'loading',
    isRefreshing: state.status === 'refreshing',
    retry,
  };
}
