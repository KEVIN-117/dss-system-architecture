export interface AdminUserRecord {
  id: number;
  username: string;
  email?: string | null;
  roles: string[];
}

export interface AdminUserDraft extends AdminUserRecord {
  password?: string;
}

export interface AdminSchemaRecord {
  id?: string;
  name: string;
  path?: string;
  type?: string;
}

export type AdminDatasourceConnectionType = 'MONDRIAN' | 'XMLA' | 'OSSIE';

export interface AdminDatasourceRecord {
  id: string;
  name: string;
  connectiontype?: AdminDatasourceConnectionType | string;
  location?: string;
  driver?: string;
  schemaName?: string | null;
  username?: string;
  ossieYaml?: string | null;
}

export interface AdminDatasourceDraft extends AdminDatasourceRecord {
  password?: string;
}

export type AdminResourceStatus = 'idle' | 'loading' | 'error';
