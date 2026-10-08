import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { CubeDesigner } from './cube-designer';
import type { CubeSchemaTable } from './types';

const tables: CubeSchemaTable[] = [
  {
    id: 'enrollments',
    name: 'enrollments',
    schema: 'academic',
    role: 'fact',
    columns: [
      { name: 'enrollment_id', dataType: 'bigint', isPrimaryKey: true },
      { name: 'student_id', dataType: 'integer', isForeignKey: true },
      { name: 'semester_id', dataType: 'integer', isForeignKey: true },
      { name: 'credits', dataType: 'numeric' },
    ],
  },
  {
    id: 'students',
    name: 'students',
    schema: 'academic',
    role: 'dimension',
    columns: [
      { name: 'student_id', dataType: 'integer', isPrimaryKey: true },
      { name: 'first_name', dataType: 'varchar' },
      { name: 'faculty_id', dataType: 'integer', isForeignKey: true },
    ],
  },
  {
    id: 'semesters',
    name: 'semesters',
    schema: 'academic',
    role: 'dimension',
    columns: [
      { name: 'semester_id', dataType: 'integer', isPrimaryKey: true },
      { name: 'year', dataType: 'integer' },
      { name: 'term', dataType: 'varchar' },
    ],
  },
  {
    id: 'faculties',
    name: 'faculties',
    schema: 'academic',
    role: 'dimension',
    columns: [
      { name: 'faculty_id', dataType: 'integer', isPrimaryKey: true },
      { name: 'faculty_name', dataType: 'varchar' },
    ],
  },
];

const demoState = {
  nodes: tables.slice(0, 3).map((table, index) => ({
    id: table.id,
    type: 'cubeTable' as const,
    position: { x: 80 + index * 360, y: index === 0 ? 80 : 240 },
    data: { table },
  })),
  edges: [
    {
      id: 'enrollments-students',
      source: 'enrollments',
      target: 'students',
      sourceHandle: 'source:student_id',
      targetHandle: 'target:student_id',
      type: 'smoothstep',
      label: 'student_id → student_id',
    },
    {
      id: 'enrollments-semesters',
      source: 'enrollments',
      target: 'semesters',
      sourceHandle: 'source:semester_id',
      targetHandle: 'target:semester_id',
      type: 'smoothstep',
      label: 'semester_id → semester_id',
    },
  ],
};

const meta: Meta<typeof CubeDesigner> = {
  title: 'Organisms/Cube Designer',
  component: CubeDesigner,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    tables,
    initialState: demoState,
    onSchemaChange: fn(),
    onSave: fn(),
    onPublish: fn(),
    className: 'h-[760px] m-4',
  },
};
export default meta;
type Story = StoryObj<typeof CubeDesigner>;

export const Workspace: Story = {};
export const EmptyCanvas: Story = {
  args: { initialState: { nodes: [], edges: [] }, className: 'h-[680px] m-4' },
};
export const AddDimension: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Add faculties' }),
    );
    await expect(
      canvas.getByRole('button', { name: 'Focus faculties' }),
    ).toBeInTheDocument();
  },
};
export const SearchCatalog: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByRole('textbox', { name: 'Search tables' }),
      'semester',
    );
    await expect(
      canvas.getByRole('button', { name: 'Focus semesters' }),
    ).toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Focus students' }),
    ).not.toBeInTheDocument();
  },
};
export const SaveDraft: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Save draft' }));
    await expect(args.onSave).toHaveBeenCalled();
  },
};
