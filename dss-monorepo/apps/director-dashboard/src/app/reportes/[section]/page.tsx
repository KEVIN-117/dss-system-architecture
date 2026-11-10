import { notFound } from 'next/navigation';
import { AcademicReports } from '@dss-monorepo/academic-analytics';

const sections = {
  rendimiento: {
    key: 'performance',
    title: 'Rendimiento académico',
    description: 'Resultados de cursado y regularidad por gestión.',
  },
  admision: {
    key: 'admission',
    title: 'Admisión estudiantil',
    description: 'Postulaciones y resultados de ingreso por gestión.',
  },
  permanencia: {
    key: 'retention',
    title: 'Permanencia estudiantil',
    description: 'Retención y deserción observada en periodos cerrados.',
  },
} as const;
export default async function ReportsPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!(section in sections)) notFound();
  const selected = sections[section as keyof typeof sections];
  return (
    <>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {selected.title}
          </h1>
          <p className="text-muted-foreground">{selected.description}</p>
        </header>
        <AcademicReports
          key={selected.key}
          section={selected.key}
          scope="career"
        />
      </div>
    </>
  );
}
