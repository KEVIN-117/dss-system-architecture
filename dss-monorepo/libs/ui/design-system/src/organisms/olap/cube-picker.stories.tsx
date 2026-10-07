import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import type { SaikuConnection } from '@dss-monorepo/olap-models';
import { CubePicker } from './cube-picker';

const connections: SaikuConnection[] = [
  {
    name: 'UATF Analytics',
    type: 'OLAP',
    catalogs: [
      {
        name: 'Academic',
        schemas: [
          {
            name: 'public',
            cubes: [
              {
                connection: 'UATF Analytics',
                catalog: 'Academic',
                schema: 'public',
                name: 'Enrollment',
                caption: 'Matrícula',
                uniqueName: '[Enrollment]',
                visible: true,
              },
              {
                connection: 'UATF Analytics',
                catalog: 'Academic',
                schema: 'public',
                name: 'Grades',
                caption: 'Rendimiento académico',
                uniqueName: '[Grades]',
                visible: true,
              },
              {
                connection: 'UATF Analytics',
                catalog: 'Academic',
                schema: 'public',
                name: 'Hidden',
                caption: 'No visible',
                uniqueName: '[Hidden]',
                visible: false,
              },
            ],
          },
        ],
      },
    ],
  },
];

const meta: Meta<typeof CubePicker> = {
  title: 'Organisms/OLAP/CubePicker',
  component: CubePicker,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { connections, onCubeChange: fn(), className: 'w-full max-w-md' },
};

export default meta;
type Story = StoryObj<typeof CubePicker>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const picker = canvas.getByRole('combobox', { name: 'Cubo' });
    await userEvent.selectOptions(picker, '[Grades]');
    await expect(args.onCubeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uniqueName: '[Grades]',
        caption: 'Rendimiento académico',
      }),
    );
  },
};

export const Selected: Story = {
  args: { selectedCubeUniqueName: '[Enrollment]' },
};
export const Loading: Story = { args: { loading: true } };
export const ErrorState: Story = {
  args: {
    error:
      'No se pudo consultar la conexión. Comprueba tu sesión e inténtalo de nuevo.',
  },
};
export const Empty: Story = { args: { connections: [] } };
