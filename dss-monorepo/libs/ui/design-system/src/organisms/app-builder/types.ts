import type { ReactNode } from 'react';

export type AppBuilderSection =
  | 'theme'
  | 'header'
  | 'navigation'
  | 'assistant'
  | 'pages';
export type AppNavigationPosition = 'rail' | 'top';

export interface AppBuilderPage {
  id: string;
  title: string;
  description?: string;
  content?: ReactNode;
}

export interface AppBuilderConfig {
  name: string;
  description?: string;
  logoUrl?: string;
  navigation: AppNavigationPosition;
  headerEyebrow?: string;
  showAssistant: boolean;
  pages: AppBuilderPage[];
}

export const defaultAppBuilderConfig: AppBuilderConfig = {
  name: 'Untitled workspace',
  description: '',
  navigation: 'rail',
  headerEyebrow: '',
  showAssistant: false,
  pages: [{ id: 'overview', title: 'Overview' }],
};
