import { notFound } from 'next/navigation';
import { AcademicReports } from '@dss-monorepo/academic-analytics';
import { ReportPageHeader } from '../../components/report-page-header';

const sections = {
  rendimiento: {
    key: 'performance',
    title: 'Rendimiento académico',
    description:
      'Consulta resultados de cursado, promedios y tasas de aprobación y reprobación por gestión en tu facultad.',
  },
  admision: {
    key: 'admission',
    title: 'Admisión estudiantil',
    description:
      'Revisa la evolución de postulantes, admitidos y resultados de ingreso en tu facultad.',
  },
  permanencia: {
    key: 'retention',
    title: 'Permanencia y deserción',
    description:
      'Analiza la retención y la deserción observada en snapshots evaluables de periodos cerrados de tu facultad.',
  },
} as const;

export default async function ReportPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const report = sections[section as keyof typeof sections];
  if (!report) notFound();
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-1 pb-8">
      <ReportPageHeader
        title={report.title}
        description={report.description}
      />
      <AcademicReports section={report.key} scope="faculty" />
    </main>
  );
}
