import { ForecastPanel } from '@dss-monorepo/academic-analytics/forecast';

/** Forecasts of the faculty's programs; Prediction Service applies the academic scope (PRED-108). */
export default function DecanoForecastsPage() {
  return <ForecastPanel scope="faculty" />;
}
