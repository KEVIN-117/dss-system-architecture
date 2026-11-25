import { ForecastPanel } from '@dss-monorepo/academic-analytics/forecast';

/** Forecast of the director's career; Prediction Service applies the academic scope (PRED-108). */
export default function DirectorForecastsPage() {
  return <ForecastPanel scope="career" />;
}
