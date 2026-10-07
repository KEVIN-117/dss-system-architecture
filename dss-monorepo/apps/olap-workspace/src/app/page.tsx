import { DashboardTemplate } from '@dss-monorepo/design-system';

export default function OlapWorkspacePage() {
  return (
    <DashboardTemplate sidebarTitle="OLAP WORKSPACE">
      <section aria-labelledby="workspace-title" className="space-y-2">
        <h1 id="workspace-title" className="text-2xl font-semibold text-foreground">
          Espacio de trabajo OLAP
        </h1>
        <p className="text-muted-foreground">
          La interfaz se compondrá con templates del design-system.
        </p>
      </section>
    </DashboardTemplate>
  );
}
