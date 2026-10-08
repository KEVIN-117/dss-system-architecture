import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from './popover';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import {
  SlidersHorizontalIcon,
  CpuIcon,
  InfoIcon,
  ActivityIcon,
} from 'lucide-react';

const meta: Meta<typeof Popover> = {
  title: 'Atoms/Popover primitives',
  component: Popover,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <div className="flex justify-center p-8">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <InfoIcon className="size-4" />
            <span>Ver Información</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <PopoverHeader>
            <PopoverTitle>Metodología HEFESTO v2</PopoverTitle>
            <PopoverDescription>
              Construcción del Data Warehouse institucional UATF con
              arquitectura en estrella.
            </PopoverDescription>
          </PopoverHeader>
          <div className="text-xs text-muted-foreground pt-1 space-y-1.5">
            <p>
              • Ingesta de fuentes transaccionales vía Pentaho PDI y Load
              Manager en Go.
            </p>
            <p>
              • Almacenamiento dimensional en PostgreSQL y relaciones en Neo4j.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  ),
};

export const WithForm: Story = {
  render: () => (
    <div className="flex justify-center p-8">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <SlidersHorizontalIcon className="size-4" />
            <span>Filtros de Métricas</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <PopoverHeader>
            <PopoverTitle>Configurar Parámetros</PopoverTitle>
            <PopoverDescription>
              Ajusta los umbrales para el modelo de riesgo de deserción
              estudiantil.
            </PopoverDescription>
          </PopoverHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-3 items-center gap-2">
              <Label htmlFor="threshold" className="text-xs">
                Umbral (%)
              </Label>
              <Input
                id="threshold"
                defaultValue="75"
                className="col-span-2 h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-2">
              <Label htmlFor="semesters" className="text-xs">
                Semestres
              </Label>
              <Input
                id="semesters"
                defaultValue="2024-2026"
                className="col-span-2 h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button size="sm" variant="default">
              Aplicar Filtros
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  ),
};

export const Variations: Story = {
  render: () => (
    <div className="flex justify-center gap-6 p-8">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            Align Start
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <PopoverTitle>Align Start</PopoverTitle>
          <PopoverDescription>
            Alineado al inicio del activador.
          </PopoverDescription>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            Align Center
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-64">
          <PopoverTitle>Align Center</PopoverTitle>
          <PopoverDescription>
            Alineado al centro del activador.
          </PopoverDescription>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            Align End
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <PopoverTitle>Align End</PopoverTitle>
          <PopoverDescription>
            Alineado al extremo final del activador.
          </PopoverDescription>
        </PopoverContent>
      </Popover>
    </div>
  ),
};

export const Cyberpunk: Story = {
  render: () => (
    <div className="flex justify-center p-8">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="border-primary/50 text-primary hover:text-primary hover:bg-primary/10 font-mono text-xs gap-2 shadow-md"
          >
            <CpuIcon className="size-4 text-primary" />
            <span>NODE_TELEMETRY_STATUS</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 bg-background/95 border-primary/40 text-foreground font-mono shadow-md backdrop-blur-md">
          <PopoverHeader className="border-b border-primary/20 pb-2">
            <div className="flex items-center justify-between">
              <PopoverTitle className="text-primary text-xs font-bold flex items-center gap-1.5">
                <ActivityIcon className="size-3.5 text-success animate-pulse" />
                NEURAL_CLUSTER_01
              </PopoverTitle>
              <span className="text-[10px] text-success font-bold">
                ONLINE
              </span>
            </div>
            <PopoverDescription className="text-primary/70 text-[11px] font-mono">
              Real-time memory allocation & inference telemetry.
            </PopoverDescription>
          </PopoverHeader>
          <div className="py-2 text-xs space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-muted-foreground">LATENCY:</span>
              <span className="text-primary font-bold">14.2 ms</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-muted-foreground">VRAM UTILIZATION:</span>
              <span className="text-warning font-bold">4.8 GB / 16 GB</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-muted-foreground">ACTIVE GOROUTINES:</span>
              <span className="text-success font-bold">128</span>
            </div>
          </div>
          <div className="pt-2 border-t border-primary/20 flex justify-end">
            <Button
              size="xs"
              variant="destructive"
              className="font-mono text-[10px] shadow-md"
            >
              PURGE BUFFER CACHE
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  ),
};
