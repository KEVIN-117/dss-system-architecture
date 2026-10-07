export type CrossFilterOperator = 'include' | 'exclude';

/** A selection made on one tile and shared with the other tiles in a dashboard. */
export interface DashboardCrossFilter {
	id: string;
	sourceTileId: string;
	dimension: string;
	values: string[];
	operator: CrossFilterOperator;
}

export interface CrossFilterSelection {
	sourceTileId: string;
	dimension: string;
	values: readonly (string | number)[];
	operator?: CrossFilterOperator;
}

export function createCrossFilter(selection: CrossFilterSelection): DashboardCrossFilter | undefined {
	const values = [...new Set(selection.values.map(String).filter(Boolean))];
	if (!selection.sourceTileId || !selection.dimension || values.length === 0) return undefined;

	return {
		id: `${selection.sourceTileId}:${selection.dimension}`,
		sourceTileId: selection.sourceTileId,
		dimension: selection.dimension,
		values,
		operator: selection.operator ?? 'include',
	};
}

/** Replace the previous selection from the same tile and dimension. */
export function setCrossFilter(
	filters: readonly DashboardCrossFilter[],
	selection: CrossFilterSelection,
): DashboardCrossFilter[] {
	const next = filters.filter(
		(filter) => filter.sourceTileId !== selection.sourceTileId || filter.dimension !== selection.dimension,
	);
	const filter = createCrossFilter(selection);
	return filter ? [...next, filter] : next;
}

export function clearCrossFilters(
	filters: readonly DashboardCrossFilter[],
	sourceTileId?: string,
): DashboardCrossFilter[] {
	return sourceTileId
		? filters.filter((filter) => filter.sourceTileId !== sourceTileId)
		: [];
}

/**
 * Test whether a row passes all active filters. Values within one filter are
 * ORed; filters from separate dimensions/sources are ANDed. A tile never
 * filters itself with its own selection.
 */
export function matchesCrossFilters<T>(
	row: T,
	filters: readonly DashboardCrossFilter[],
	readDimension: (row: T, dimension: string) => string | number | null | undefined,
	targetTileId?: string,
): boolean {
	return filters.every((filter) => {
		if (filter.sourceTileId === targetTileId) return true;
		const rawValue = readDimension(row, filter.dimension);
		if (rawValue == null) return filter.operator === 'exclude';

		const selected = filter.values.includes(String(rawValue));
		return filter.operator === 'exclude' ? !selected : selected;
	});
}
