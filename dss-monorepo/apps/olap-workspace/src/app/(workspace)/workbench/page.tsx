'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@dss-monorepo/auth';
import {
  MdxWorkbench,
  type DrillthroughResult,
} from '@dss-monorepo/design-system';
import {
  drillthrough,
  executeMdxQuery,
  listOlapConnections,
  previewSqlQuery,
} from '@dss-monorepo/olap-data-access';
import {
  parseCellset,
  toNumber,
  type QueryResult,
  type SaikuConnection,
  type SaikuCube,
} from '@dss-monorepo/olap-models';
import { SaikuChart } from '@dss-monorepo/charts';

export default function WorkbenchPage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<SaikuConnection[]>([]);

  useEffect(() => {
    if (!user?.username) return;
    let active = true;
    void listOlapConnections(user.username)
      .then((items) => {
        if (active) setConnections(items);
      })
      .catch(() => {
        // handled in UI
      });
    return () => {
      active = false;
    };
  }, [user?.username]);

  const handleExecuteMdx = async (mdx: string, cube: SaikuCube): Promise<QueryResult> => {
    return executeMdxQuery(cube, mdx);
  };

  const handlePreviewSql = async (mdx: string, cube: SaikuCube): Promise<string> => {
    const res = await previewSqlQuery({
      name: 'preview',
      cube,
      queryType: 'OLAP',
      type: 'MDX',
      mdx,
    });
    return res.sql;
  };

  const handleDrillthrough = async (
    queryName: string,
    position?: string,
  ): Promise<DrillthroughResult> => {
    const drillResponse = await drillthrough(queryName, {
      position,
      maxRows: 500,
    });
    if (drillResponse.error) throw new Error(drillResponse.error);
    const cellRows = drillResponse.cellset ?? [];
    if (cellRows.length === 0) {
      return { columns: [], rows: [] };
    }
    const columns = cellRows[0].map((c) => c.value || 'Columna');
    const rows = cellRows.slice(1).map((r) => r.map((c) => c.value));
    return {
      columns,
      rows,
      runtimeMs: drillResponse.runtime,
    };
  };

  const renderChart = (result: QueryResult) => {
    const parsed = parseCellset(result);
    const projection = {
      rowCategories: parsed.rowCategories.length
        ? parsed.rowCategories
        : parsed.dataRows.map((_, index) => String(index + 1)),
      columnCategories: parsed.columnCategories.length
        ? parsed.columnCategories
        : (parsed.dataRows[0] ?? []).map((_, index) => `Medida ${index + 1}`),
      matrix: parsed.dataRows.map((row) => row.map((cell) => toNumber(cell))),
    };
    return <SaikuChart chartType="bar" projection={projection} height={420} />;
  };

  return (
    <main className="space-y-6" aria-labelledby="workbench-heading">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Consola Avanzada
        </p>
        <h1
          id="workbench-heading"
          className="mt-1 text-2xl font-semibold text-foreground tracking-tight"
        >
          MDX & SQL Workbench
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Escribe consultas MDX con Monaco Editor, previsualiza el SQL traducido por Mondrian/Calcite e inspecciona resultados con drillthrough interactivo.
        </p>
      </header>

      <MdxWorkbench
        connections={connections}
        onExecuteMdx={handleExecuteMdx}
        onPreviewSql={handlePreviewSql}
        onDrillthrough={handleDrillthrough}
        renderChart={renderChart}
      />
    </main>
  );
}
