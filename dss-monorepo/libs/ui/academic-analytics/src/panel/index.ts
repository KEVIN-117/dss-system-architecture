export { RendimientoViewPanel, type PanelScope } from './rendimiento-view';
export { RENDIMIENTO_VIEWS, findView, type RendimientoView, type Breakdown, type ViewMeasure } from './rendimiento-views';
export { ADMISION_VIEWS, findAdmisionView } from './admision-views';
export { PERMANENCIA_VIEWS, findPermanenciaView } from './permanencia-views';
export { analyticsNavigation, type AnalyticsNavGroup } from './navigation';
export { CareerSummaryDashboard, FacultySummaryDashboard } from './scope-summary';
export {
  ATTENTION_THRESHOLD,
  CAREER_RULES,
  FACULTY_RULES,
  attentionFor,
  deltaOf,
  facultiesIn,
  facultyYearSeries,
  mergeCareers,
  previousYear,
  type CareerRow,
  type SummaryValues,
} from './faculty-summary-data';
