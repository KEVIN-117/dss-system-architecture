import { AcademicReports } from '@dss-monorepo/academic-analytics';
import { ReportPageHeader } from '../../../components/report-page-header';

export default function AdmissionDistributionPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <ReportPageHeader
        title="Distribución de postulantes"
        description="Explora postulantes y admitidos por género, carrera, sede y otras características publicadas por el cubo."
        parent={{ label: 'Admisión', href: '/reportes/admision' }}
      />
      <AcademicReports
        section="admission"
        scope="faculty"
        view="distribution"
      />
    </main>
  );
}
