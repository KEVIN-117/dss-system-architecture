import { AcademicReports } from '@dss-monorepo/academic-analytics';
import { ReportPageHeader } from '../../../components/report-page-header';

export default function AcademicRegularityPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <ReportPageHeader
        title="Regularidad y continuidad"
        description="Revisa la repetición y el abandono de intentos de cursado por gestión académica en tu facultad."
        parent={{ label: 'Rendimiento', href: '/reportes/rendimiento' }}
      />
      <AcademicReports
        section="performance"
        scope="faculty"
        view="regularity"
      />
    </main>
  );
}
