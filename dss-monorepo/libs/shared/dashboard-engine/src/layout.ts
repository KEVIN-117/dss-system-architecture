export const DASHBOARD_BREAKPOINTS = ['lg', 'md', 'sm', 'xs', 'xxs'] as const;

export type DashboardBreakpoint = (typeof DASHBOARD_BREAKPOINTS)[number];

/** Grid position for one dashboard tile. Coordinates and dimensions use grid units. */
export interface DashboardLayoutItem {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	minW?: number;
	minH?: number;
	maxW?: number;
	maxH?: number;
	static?: boolean;
}

/** Responsive layout saved for each supported grid breakpoint. */
export type DashboardLayouts = Partial<Record<DashboardBreakpoint, DashboardLayoutItem[]>>;

export function createEmptyDashboardLayouts(): DashboardLayouts {
	return Object.fromEntries(DASHBOARD_BREAKPOINTS.map((breakpoint) => [breakpoint, []])) as DashboardLayouts;
}

/** Copy a layout while removing malformed and duplicate tile entries. */
export function normalizeDashboardLayout(items: readonly DashboardLayoutItem[]): DashboardLayoutItem[] {
	const ids = new Set<string>();
	const normalized: DashboardLayoutItem[] = [];

	for (const item of items) {
		if (!item.id || ids.has(item.id)) continue;
		if (![item.x, item.y, item.w, item.h].every(Number.isFinite) || item.w <= 0 || item.h <= 0) continue;

		ids.add(item.id);
		normalized.push({ ...item });
	}

	return normalized;
}
