import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Activity,
  BrainCircuit,
  Cable,
  CalendarClock,
  Database,
  LayoutDashboard,
  Users,
} from 'lucide-react';

import { DashboardTemplate } from './dashboard';

const meta: Meta<typeof DashboardTemplate> = {
  title: 'Templates/Dashboard',
  component: DashboardTemplate,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof DashboardTemplate>;

export const ServiceNavigation: Story = {
  args: {
    sidebarTitle: 'Administración DSS',
    surfaceMaterial: 'frosted',
    user: {
      name: 'María Fernández',
      email: 'maria.fernandez@uatf.edu.bo',
    },
    navGroups: [
      {
        title: 'Plataforma',
        items: [
          {
            title: 'Resumen general',
            href: '#overview',
            icon: <LayoutDashboard aria-hidden="true" />,
          },
        ],
      },
      {
        title: 'Auth Service',
        items: [
          {
            title: 'Usuarios',
            href: '#users',
            icon: <Users aria-hidden="true" />,
          },
        ],
      },
      {
        title: 'OLAP Service',
        items: [
          {
            title: 'Conexiones',
            href: '#datasources',
            icon: <Cable aria-hidden="true" />,
            isActive: true,
          },
          {
            title: 'Esquemas y cubos',
            href: '#schemas',
            icon: <Database aria-hidden="true" />,
          },
        ],
      },
      {
        title: 'DW Control Service',
        items: [
          {
            title: 'Cierres académicos',
            href: '#academic-closures',
            icon: <CalendarClock aria-hidden="true" />,
          },
          {
            title: 'Ejecuciones ETL',
            href: '#etl-executions',
            icon: <Activity aria-hidden="true" />,
          },
        ],
      },
      {
        title: 'ML Service',
        items: [
          {
            title: 'Operaciones ML',
            href: '#ml-operations',
            icon: <BrainCircuit aria-hidden="true" />,
          },
        ],
      },
    ],
    children: (
      <section className="mx-auto max-w-6xl space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Resumen general
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Un punto de entrada para operar los servicios institucionales y
          revisar su información disponible.
        </p>
      </section>
    ),
  },
};
