import { clearCrossFilters, setCrossFilter, type CrossFilterSelection, type DashboardCrossFilter } from './cross-filters.js';
import {
	createEmptyDashboardLayouts,
	normalizeDashboardLayout,
	type DashboardBreakpoint,
	type DashboardLayoutItem,
	type DashboardLayouts,
} from './layout.js';

export interface DashboardState {
	dashboardId: string;
	layouts: DashboardLayouts;
	crossFilters: DashboardCrossFilter[];
}

export type DashboardAction =
	| { type: 'layout/changed'; breakpoint: DashboardBreakpoint; items: readonly DashboardLayoutItem[] }
	| { type: 'filter/changed'; selection: CrossFilterSelection }
	| { type: 'filter/cleared'; sourceTileId?: string }
	| { type: 'state/replaced'; state: DashboardState };

export function createDashboardState(dashboardId: string): DashboardState {
	return {
		dashboardId,
		layouts: createEmptyDashboardLayouts(),
		crossFilters: [],
	};
}

/** Pure reducer shared by dashboard shells and UI adapters. */
export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
	switch (action.type) {
		case 'layout/changed':
			return {
				...state,
				layouts: {
					...state.layouts,
					[action.breakpoint]: normalizeDashboardLayout(action.items),
				},
			};
		case 'filter/changed':
			return { ...state, crossFilters: setCrossFilter(state.crossFilters, action.selection) };
		case 'filter/cleared':
			return { ...state, crossFilters: clearCrossFilters(state.crossFilters, action.sourceTileId) };
		case 'state/replaced':
			return action.state;
		default:
			return state;
	}
}
