import type { Meta, StoryObj } from '@storybook/react-vite';
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
          {
            name: 'Sistemas',
            children: [
              { name: 'Cohorte 2024', value: 180 },
              { name: 'Cohorte 2025', value: 210 },
              {
                name: 'Especialidades',
                children: [
                  { name: 'IA', value: 60 },
                  { name: 'Redes', value: 50 },
                  { name: 'Seguridad', value: 70 },
                ],
              },
            ],
          },
          {
            name: 'Civil',
            children: [
              { name: 'Cohorte 2024', value: 140 },
              { name: 'Cohorte 2025', value: 160 },
              {
                name: 'Áreas',
                children: [
                  { name: 'Estructuras', value: 80 },
                  { name: 'Hidráulica', value: 60 },
                  { name: 'Transportes', value: 40 },
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Ciencias',
        children: [
          {
            name: 'Física',
            children: [
              { name: 'Teórica', value: 40 },
              { name: 'Experimental', value: 40 },
            ],
          },
          {
            name: 'Matemáticas',
            children: [
              { name: 'Pura', value: 50 },
              { name: 'Aplicada', value: 40 },
            ],
          },
        ],
      },
      {
        name: 'Humanidades',
        children: [
          {
            name: 'Historia',
            children: [
              { name: 'Antigua', value: 30 },
              { name: 'Moderna', value: 25 },
            ],
          },
          {
            name: 'Filosofía',
            children: [
              { name: 'Ética', value: 20 },
              { name: 'Metafísica', value: 15 },
            ],
          },
        ],
      },
    ],
  },
};
