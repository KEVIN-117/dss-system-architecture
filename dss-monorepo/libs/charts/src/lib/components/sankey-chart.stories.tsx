import type { Meta, StoryObj } from '@storybook/react';
import { AcademicSankeyChart } from './sankey-chart';

const meta: Meta<typeof AcademicSankeyChart> = {
  title: 'Charts/AcademicSankeyChart',
  component: AcademicSankeyChart,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AcademicSankeyChart>;

export const Default: Story = {
  args: {
    title: 'Flujo de Retención Estudiantil',
    data: {
      nodes: [
        { name: 'Ingreso S1' },
        { name: 'Promovido S2' },
        { name: 'Repitente' },
        { name: 'Deserción' }
      ],
      links: [
        { source: 'Ingreso S1', target: 'Promovido S2', value: 700 },
        { source: 'Ingreso S1', target: 'Repitente', value: 200 },
        { source: 'Ingreso S1', target: 'Deserción', value: 100 }
      ]
    }
  },
};
