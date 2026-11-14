import { EmbeddedOlapWorkspace } from '@dss-monorepo/academic-analytics/olap-portal';

export const metadata = { title: 'Análisis OLAP | Portal de Dirección' };

export default function OlapAnalysisPage() {
  return <EmbeddedOlapWorkspace />;
}
