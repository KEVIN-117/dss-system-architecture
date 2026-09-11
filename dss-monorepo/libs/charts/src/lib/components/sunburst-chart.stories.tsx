import type { Meta, StoryObj } from '@storybook/react';
import { AcademicSunburstChart } from './sunburst-chart';

const meta: Meta<typeof AcademicSunburstChart> = {
  title: 'Charts/AcademicSunburstChart',
  component: AcademicSunburstChart,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AcademicSunburstChart>;

export const Default: Story = {
  args: {
    title: 'Estructura Institucional',
    data: [
      {
        name: 'Ingeniería',
        children: [
          { name: 'Sistemas', children: [{ name: 'Cohorte 2024', value: 180 }, { name: 'Cohorte 2025', value: 210 }] },
          { name: 'Civil', children: [{ name: 'Cohorte 2024', value: 140 }, { name: 'Cohorte 2025', value: 160 }] }
        ]
      },
      {
        name: 'Ciencias',
        children: [
          { name: 'Física', value: 80 },
          { name: 'Matemáticas', value: 90 }
        ]
      }
    ]
  },
};
