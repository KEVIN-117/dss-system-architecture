import type { Meta, StoryObj } from '@storybook/react';
import { AcademicRadarChart } from './radar-chart';

const meta: Meta<typeof AcademicRadarChart> = {
  title: 'Charts/AcademicRadarChart',
  component: AcademicRadarChart,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AcademicRadarChart>;

export const Default: Story = {
  args: {
    title: 'Perfil de Competencias (Estudiante vs Esperado)',
    data: {
      indicators: [
        { name: 'Comprensión Lectora', max: 100 },
        { name: 'Razonamiento Matemático', max: 100 },
        { name: 'Resolución de Problemas', max: 100 },
        { name: 'Trabajo en Equipo', max: 100 },
        { name: 'Competencias Digitales', max: 100 },
      ],
      series: [
        { name: 'Estudiante', value: [85, 90, 78, 65, 80] },
        { name: 'Esperado', value: [70, 70, 70, 70, 70] },
      ]
    },
  },
};
