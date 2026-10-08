import {
	DASHBOARD_BREAKPOINTS,
	normalizeDashboardLayout,
	type DashboardLayoutItem,
	type DashboardLayouts,
} from './layout.js';
import type { DashboardState } from './state.js';
import type { DashboardCrossFilter } from './cross-filters.js';

export interface DashboardUrlSyncOptions {
	/** Query parameter used for the serialized dashboard state. */
	parameter?: string;
	/** Choose whether writing the state adds a browser history entry. */
	mode?: 'push' | 'replace';
}

export interface DashboardBrowserHistory {
	location: { href: string };
	history: {
		pushState(data: unknown, unused: string, url?: string | URL | null): void;
		replaceState(data: unknown, unused: string, url?: string | URL | null): void;
	};
}

const DEFAULT_PARAMETER = 'dssDashboard';

/** Read dashboard state from a URL. Malformed or unsupported payloads return undefined. */
export function readDashboardStateFromUrl(
	input: string | URL,
	parameter = DEFAULT_PARAMETER,
): DashboardState | undefined {
	try {
		const url = input instanceof URL ? input : new URL(input, 'http://localhost');
		const encoded = url.searchParams.get(parameter);
		if (!encoded) return undefined;
		return parseDashboardState(JSON.parse(encoded) as unknown);
	} catch {
		return undefined;
	}
}

/** Return a URL with the dashboard state parameter updated, preserving other query params and hash. */
export function serializeDashboardStateToUrl(
	state: DashboardState,
	input: string | URL,
	parameter = DEFAULT_PARAMETER,
): string {
	const url = input instanceof URL ? new URL(input.href) : new URL(input, 'http://localhost');
	url.searchParams.set(parameter, JSON.stringify(state));
	return input instanceof URL || isAbsoluteUrl(input) ? url.href : `${url.pathname}${url.search}${url.hash}`;
}

/** Read current state, then synchronize it into browser history without coupling the engine to React. */
export function syncDashboardStateToUrl(
	state: DashboardState,
	options: DashboardUrlSyncOptions = {},
	browser: DashboardBrowserHistory = globalThis as unknown as DashboardBrowserHistory,
): string {
	const nextUrl = serializeDashboardStateToUrl(state, browser.location.href, options.parameter);
	if (options.mode === 'push') browser.history.pushState(null, '', nextUrl);
	else browser.history.replaceState(null, '', nextUrl);
	return nextUrl;
}

function parseDashboardState(value: unknown): DashboardState | undefined {
	if (!isRecord(value) || typeof value.dashboardId !== 'string' || !value.dashboardId) return undefined;
	const layouts: DashboardLayouts = {};
	if (isRecord(value.layouts)) {
		for (const breakpoint of DASHBOARD_BREAKPOINTS) {
			const items = value.layouts[breakpoint];
			if (Array.isArray(items)) {
				layouts[breakpoint] = normalizeDashboardLayout(items.filter(isLayoutItem));
			}
		}
	}
	const crossFilters = Array.isArray(value.crossFilters)
		? value.crossFilters.filter(isCrossFilter).map((filter) => ({ ...filter, values: [...new Set(filter.values)] }))
		: [];
	return { dashboardId: value.dashboardId, layouts, crossFilters };
}

function isLayoutItem(value: unknown): value is DashboardLayoutItem {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === 'string' &&
		Number.isFinite(value.x) &&
		Number.isFinite(value.y) &&
		Number.isFinite(value.w) &&
		Number.isFinite(value.h)
	);
}

function isCrossFilter(value: unknown): value is DashboardCrossFilter {
	return (
		isRecord(value) &&
		typeof value.id === 'string' &&
		typeof value.sourceTileId === 'string' &&
		typeof value.dimension === 'string' &&
		Array.isArray(value.values) &&
		value.values.every((member) => typeof member === 'string') &&
		(value.operator === 'include' || value.operator === 'exclude')
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbsoluteUrl(input: string | URL): boolean {
	return input instanceof URL || /^[a-z][a-z\d+.-]*:/i.test(input);
}
