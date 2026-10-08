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

export type AdminResourceStatus = 'idle' | 'loading' | 'error';
