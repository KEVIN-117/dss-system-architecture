import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './table';
import { Badge } from '../atoms/badge';
import { Button } from '../atoms/button';
import { Terminal } from 'lucide-react';

const meta: Meta<typeof Table> = {
  title: 'Molecules/Table',
  component: Table,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Table>;

const defaultStudents = [
  {
    ru: 'RU-74892',
    name: 'Alvaro Mendoza',
    career: 'Ing. Sistemas',
    semester: '7mo',
    gpa: 88.5,
    status: 'Regular',
  },
  {
    ru: 'RU-81204',
    name: 'Valeria Quispe',
    career: 'Ing. Sistemas',
    semester: '5to',
    gpa: 94.2,
    status: 'Destacado',
  },
  {
    ru: 'RU-69431',
    name: 'Rodrigo Flores',
    career: 'Ing. Industrial',
    semester: '3ro',
    gpa: 58.0,
    status: 'Condicional',
  },
  {
    ru: 'RU-90518',
    name: 'Elena Mamani',
    career: 'Ing. Civil',
    semester: '8vo',
    gpa: 82.3,
    status: 'Regular',
  },
  {
    ru: 'RU-88310',
    name: 'Carlos Gutierrez',
    career: 'Ing. Sistemas',
    semester: '4to',
    gpa: 91.0,
    status: 'Destacado',
  },
];

export const Default: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <Table>
        <TableCaption>
          Registro de Rendimiento Académico Estudiantil - UATF DSS
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Registro (RU)</TableHead>
            <TableHead>Estudiante</TableHead>
            <TableHead>Carrera</TableHead>
            <TableHead className="text-center">Semestre</TableHead>
            <TableHead className="text-right">Promedio</TableHead>
            <TableHead className="text-center">Condición</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {defaultStudents.map((student) => (
            <TableRow key={student.ru}>
              <TableCell className="font-mono font-medium">
                {student.ru}
              </TableCell>
              <TableCell className="font-sans">{student.name}</TableCell>
              <TableCell className="font-sans text-muted-foreground">
                {student.career}
              </TableCell>
              <TableCell className="text-center font-mono">
                {student.semester}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {student.gpa.toFixed(1)}
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant={
                    student.status === 'Destacado'
                      ? 'default'
                      : student.status === 'Condicional'
                        ? 'destructive'
                        : 'secondary'
                  }
                  className="text-[11px]"
                >
                  {student.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4} className="font-sans">
              Promedio General de Cohorte
            </TableCell>
            <TableCell className="text-right font-bold text-primary font-mono">
              82.8
            </TableCell>
            <TableCell className="text-center text-xs text-muted-foreground font-mono">
              5 Estudiantes
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  ),
};

const clusterNodes = [
  {
    id: 'node-alpha-01',
    process: 'dss-query-manager-go',
    cpu: '14.2%',
    mem: '42.8 MB',
    iops: '1.2k',
    latency: '4ms',
    status: 'ONLINE',
  },
  {
    id: 'node-alpha-02',
    process: 'dss-load-manager-go',
    cpu: '38.6%',
    mem: '118.4 MB',
    iops: '8.4k',
    latency: '9ms',
    status: 'ONLINE',
  },
  {
    id: 'node-beta-01',
    process: 'dw-postgres-star',
    cpu: '52.1%',
    mem: '2.4 GB',
    iops: '15.9k',
    latency: '12ms',
    status: 'ONLINE',
  },
  {
    id: 'node-gamma-01',
    process: 'neo4j-graph-cluster',
    cpu: '29.4%',
    mem: '1.1 GB',
    iops: '4.8k',
    latency: '6ms',
    status: 'ONLINE',
  },
  {
    id: 'node-delta-01',
    process: 'ml-inference-xgboost',
    cpu: '76.8%',
    mem: '840 MB',
    iops: '2.1k',
    latency: '18ms',
    status: 'BUSY',
  },
  {
    id: 'node-edge-01',
    process: 'superset-bi-gateway',
    cpu: '8.5%',
    mem: '310 MB',
    iops: '640',
    latency: '2ms',
    status: 'IDLE',
  },
];

export const CyberpunkTerminal: Story = {
  render: () => (
    <div className="p-6 bg-black/95 rounded-xl border border-primary/30 shadow-[0_0_30px_rgba(0,255,200,0.1)] max-w-4xl font-mono">
      <div className="flex items-center justify-between border-b border-primary/20 pb-3 mb-4">
        <div className="flex items-center gap-2 text-primary">
          <Terminal className="size-4 animate-pulse" />
          <span className="text-xs uppercase font-bold tracking-widest">
            MAINFRAME_CLUSTER_MATRIX // REALTIME_GRID
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground">
            CLUSTER_SYNC: 04:12:09 UTC
          </span>
          <Badge
            variant="outline"
            className="border-primary/40 text-primary text-[10px] shadow-[0_0_8px_rgba(59,130,246,0.3)]"
          >
            POLLING: 1000ms
          </Badge>
        </div>
      </div>

      <Table className="border-0">
        <TableHeader className="bg-black/60 border-b border-primary/30">
          <TableRow className="border-primary/20 hover:bg-transparent">
            <TableHead className="text-primary text-xs font-mono">
              NODE_IDENTIFIER
            </TableHead>
            <TableHead className="text-primary text-xs font-mono">
              DAEMON_SERVICE
            </TableHead>
            <TableHead className="text-primary text-xs font-mono text-right">
              CPU
            </TableHead>
            <TableHead className="text-primary text-xs font-mono text-right">
              MEM_USAGE
            </TableHead>
            <TableHead className="text-primary text-xs font-mono text-right">
              IOPS
            </TableHead>
            <TableHead className="text-primary text-xs font-mono text-right">
              LATENCY
            </TableHead>
            <TableHead className="text-primary text-xs font-mono text-center">
              TELEMETRY_FLAG
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clusterNodes.map((node) => (
            <TableRow
              key={node.id}
              className="border-b border-primary/10 hover:bg-primary/10"
            >
              <TableCell className="font-mono text-xs text-primary/90">
                {node.id}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {node.process}
              </TableCell>
              <TableCell className="font-mono text-xs text-right text-foreground">
                {node.cpu}
              </TableCell>
              <TableCell className="font-mono text-xs text-right text-foreground">
                {node.mem}
              </TableCell>
              <TableCell className="font-mono text-xs text-right text-muted-foreground">
                {node.iops}
              </TableCell>
              <TableCell className="font-mono text-xs text-right text-emerald-400">
                {node.latency}
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant={
                    node.status === 'ONLINE'
                      ? 'default'
                      : node.status === 'BUSY'
                        ? 'destructive'
                        : 'secondary'
                  }
                  className="text-[10px] uppercase font-mono px-2 py-0.5"
                >
                  <span
                    className={`size-1.5 rounded-full inline-block mr-1.5 ${
                      node.status === 'ONLINE'
                        ? 'bg-emerald-400 animate-pulse'
                        : node.status === 'BUSY'
                          ? 'bg-amber-400 animate-ping'
                          : 'bg-muted-foreground'
                    }`}
                  />
                  {node.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter className="bg-black/60 border-t border-primary/30">
          <TableRow className="border-0 hover:bg-transparent">
            <TableCell
              colSpan={2}
              className="text-xs font-mono text-muted-foreground"
            >
              CLUSTER TOTAL: 6/6 NODES ACTIVE
            </TableCell>
            <TableCell className="text-right font-mono text-xs text-primary font-bold">
              AVG 36.6%
            </TableCell>
            <TableCell className="text-right font-mono text-xs text-primary font-bold">
              4.8 GB
            </TableCell>
            <TableCell className="text-right font-mono text-xs text-primary font-bold">
              32.4k
            </TableCell>
            <TableCell className="text-right font-mono text-xs text-emerald-400 font-bold">
              8.5ms
            </TableCell>
            <TableCell className="text-center font-mono text-[10px] text-emerald-400">
              HEALTHY
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  ),
};

const riskPredictions = [
  {
    ru: 'RU-74011',
    career: 'Ing. Sistemas',
    failed: 4,
    riskScore: 84.5,
    factor: 'Baja asistencia & Filtro reprobado',
    alert: 'CRÍTICO',
  },
  {
    ru: 'RU-89204',
    career: 'Ing. Industrial',
    failed: 3,
    riskScore: 68.2,
    factor: 'Deserción en materias prerrequisito',
    alert: 'MODERADO',
  },
  {
    ru: 'RU-62109',
    career: 'Ing. Civil',
    failed: 5,
    riskScore: 92.1,
    factor: 'Abandono prolongado de exámenes',
    alert: 'CRÍTICO',
  },
  {
    ru: 'RU-91332',
    career: 'Ing. Sistemas',
    failed: 1,
    riskScore: 32.0,
    factor: 'Rendimiento estable en básicas',
    alert: 'BAJO',
  },
  {
    ru: 'RU-77402',
    career: 'Ing. Minera',
    failed: 2,
    riskScore: 54.8,
    factor: 'Retraso de inscripción semestral',
    alert: 'MODERADO',
  },
];

export const StudentRiskPrediction: Story = {
  render: () => (
    <div className="w-full max-w-4xl space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold font-heading">
            Predicción Temprana de Abandono Estudiantil
          </h3>
          <p className="text-xs text-muted-foreground">
            Modelo Predictivo XGBoost con balanceo SMOTE y explicabilidad SHAP
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-mono">
          Semestre 2026-I
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Registro (RU)</TableHead>
            <TableHead>Carrera</TableHead>
            <TableHead className="text-center">Materias Reprobadas</TableHead>
            <TableHead className="text-right">Score de Riesgo</TableHead>
            <TableHead>Factor Predictivo Clave</TableHead>
            <TableHead className="text-center">Alerta</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {riskPredictions.map((row) => (
            <TableRow key={row.ru}>
              <TableCell className="font-mono font-medium">{row.ru}</TableCell>
              <TableCell>{row.career}</TableCell>
              <TableCell className="text-center font-mono">
                {row.failed}
              </TableCell>
              <TableCell className="text-right font-mono font-bold">
                <span
                  className={
                    row.riskScore > 75
                      ? 'text-destructive'
                      : row.riskScore > 50
                        ? 'text-amber-500'
                        : 'text-emerald-500'
                  }
                >
                  {row.riskScore.toFixed(1)}%
                </span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {row.factor}
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant={
                    row.alert === 'CRÍTICO'
                      ? 'destructive'
                      : row.alert === 'MODERADO'
                        ? 'secondary'
                        : 'default'
                  }
                  className="text-[10px]"
                >
                  {row.alert}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs font-mono hover:bg-primary/20 hover:text-primary"
                >
                  Ver SHAP
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};
