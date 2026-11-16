import {
  resolveAdmissionPaths,
  resolveRetentionPaths,
} from '../app/components/analytics-data';

export interface PublishedMember {
  name: string;
  uniqueName: string;
  caption?: string | null;
}

export interface CubeAxisPath {
  dimension: string;
  hierarchy: string;
  level: string;
}

export interface AcademicCubePaths {
  enrollmentAttempts: string;
  averageFinalGrade: string;
  enrollmentUnit: string;
  gradeUnit: string;
  academicYear: CubeAxisPath;
  academicPeriod: CubeAxisPath;
  faculty: CubeAxisPath;
}

export interface ChartPoint {
  label: string;
  value: number;
}

export type RecordValue = Record<string, unknown>;

export interface CubeSummary {
  cubeId: string;
  cubeName: string;
  cubeCaption?: string | null;
}

export type AdmissionPaths = NonNullable<ReturnType<typeof resolveAdmissionPaths>>;
export type RetentionPaths = NonNullable<ReturnType<typeof resolveRetentionPaths>>;
export type FacultyRow = {
  label: string;
  applications: number;
  admitted: number | null;
  admittedApplications: number | null;
  known: number | null;
};
export type QueryResponse = { analyticQuery: { data: unknown[]; totalRows: number } };