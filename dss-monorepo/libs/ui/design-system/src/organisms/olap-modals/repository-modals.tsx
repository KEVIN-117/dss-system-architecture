'use client';

import * as React from 'react';
import { Button } from '../../atoms/button';
import { Checkbox } from '../../atoms/checkbox';
import { Input } from '../../atoms/input';
import { Select } from '../../atoms/select';
import { OlapModal } from './olap-modal';
import { OlapModalActions, OlapModalField } from './modal-parts';

interface BaseProps {
  open: boolean;
  onCancel: () => void;
}

const closeOnRequest = (onCancel: () => void) => (open: boolean) => {
  if (!open) onCancel();
};

function normalizeFolder(value: string) {
  return value.replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
}

export interface SaveQueryModalProps extends BaseProps {
  defaultName: string;
  defaultFolder: string;
  folders: string[];
  folderPicker?: React.ReactNode;
  onSave: (folder: string, name: string) => void;
}

export function SaveQueryModal({ defaultName, defaultFolder, folders, folderPicker, open, onSave, onCancel }: SaveQueryModalProps) {
  const [name, setName] = React.useState(defaultName);
  const [folder, setFolder] = React.useState(defaultFolder);
  React.useEffect(() => { if (open) { setName(defaultName); setFolder(defaultFolder); } }, [open, defaultName, defaultFolder]);
  const valid = name.trim().length > 0;
  function save() { if (valid) onSave(normalizeFolder(folder), name.trim()); }

  return (
    <OlapModal
      open={open}
      onOpenChange={closeOnRequest(onCancel)}
      title="Guardar consulta"
      description={`La consulta se guardará en ${folder || '/'}.`}
      size="lg"
      footer={<OlapModalActions onCancel={onCancel} onApply={save} applyLabel="Guardar" disabled={!valid} />}
    >
      <div className="space-y-4">
        <OlapModalField id="save-query-name" label="Nombre">
          <Input id="save-query-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
        </OlapModalField>
        {folderPicker ?? (
          <OlapModalField id="save-query-folder" label="Carpeta">
            <Select id="save-query-folder" value={folder} onChange={(event) => setFolder(event.target.value)}>
              {folders.map((option) => <option key={option} value={option}>{option || '/'}</option>)}
            </Select>
          </OlapModalField>
        )}
      </div>
    </OlapModal>
  );
}

export interface SavedQueryItem<TQuery = unknown> {
  path: string;
  name: string;
  modified?: string;
  query: TQuery;
}

export interface SavedQueriesModalProps<TQuery = unknown> extends BaseProps {
  queries: SavedQueryItem<TQuery>[];
  onOpenQuery: (path: string, query: TQuery) => void;
  onDelete?: (query: SavedQueryItem<TQuery>) => void;
  onManagePermissions?: (query: SavedQueryItem<TQuery>) => void;
  title?: React.ReactNode;
}

export function SavedQueriesModal<TQuery>({
  queries,
  onOpenQuery,
  onDelete,
  onManagePermissions,
  open,
  onCancel,
  title = 'Consultas guardadas',
}: SavedQueriesModalProps<TQuery>) {
  const [search, setSearch] = React.useState('');
  React.useEffect(() => { if (open) setSearch(''); }, [open]);
  const filtered = queries.filter((query) => `${query.name} ${query.path}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <OlapModal open={open} onOpenChange={closeOnRequest(onCancel)} title={title} size="lg" footer={<Button variant="outline" onClick={onCancel}>Cerrar</Button>}>
      <div className="space-y-3">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar consultas…" aria-label="Buscar consultas guardadas" />
        {filtered.length ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {filtered.map((query) => (
              <li key={query.path} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <button type="button" className="min-w-0 flex-1 text-left hover:text-primary" onClick={() => onOpenQuery(query.path, query.query)}>
                  <span className="block truncate text-sm font-medium">{query.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{query.path}{query.modified ? ` · ${query.modified}` : ''}</span>
                </button>
                {onManagePermissions ? <Button size="sm" variant="outline" onClick={() => onManagePermissions(query)}>Permisos</Button> : null}
                {onDelete ? <Button size="sm" variant="destructive" onClick={() => onDelete(query)}>Eliminar</Button> : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No hay consultas que coincidan con la búsqueda.</div>
        )}
      </div>
    </OlapModal>
  );
}

export interface OssieLoadItem { path: string; name: string; }
export interface OssieLoadModalProps extends BaseProps {
  items: OssieLoadItem[];
  initialPath?: string;
  onOpen: (path: string) => void;
  repositoryBrowser?: React.ReactNode;
}

export function OssieLoadModal({ items, initialPath = '', onOpen, open, onCancel, repositoryBrowser }: OssieLoadModalProps) {
  const [selected, setSelected] = React.useState(initialPath);
  React.useEffect(() => { if (open) setSelected(initialPath); }, [open, initialPath]);
  const valid = selected.trim().length > 0 && selected.endsWith('.saiku');
  return (
    <OlapModal open={open} onOpenChange={closeOnRequest(onCancel)} title="Abrir consulta guardada" size="lg" footer={<OlapModalActions onCancel={onCancel} onApply={() => onOpen(selected)} applyLabel="Abrir" disabled={!valid} />}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Selecciona un archivo de consulta `.saiku`.</p>
        {repositoryBrowser ?? (
          <OlapModalField id="ossie-query-file" label="Consulta">
            <Select id="ossie-query-file" value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">Selecciona una consulta</option>
              {items.map((item) => <option key={item.path} value={item.path}>{item.name}</option>)}
            </Select>
          </OlapModalField>
        )}
      </div>
    </OlapModal>
  );
}

export type AclType = 'PRIVATE' | 'SECURED' | 'PUBLIC';
export type AclMethod = 'READ' | 'WRITE' | 'GRANT';
export interface AclEntry {
  owner: string;
  type: AclType;
  roles: Record<string, AclMethod[]>;
  users: Record<string, AclMethod[]>;
}

export interface PermissionsModalProps extends BaseProps {
  path: string;
  allRoles: string[];
  initial: AclEntry;
  onSave: (acl: AclEntry) => void;
}

export function PermissionsModal({ path, allRoles, initial, open, onSave, onCancel }: PermissionsModalProps) {
  const [acl, setAcl] = React.useState<AclEntry>(() => structuredClone(initial));
  React.useEffect(() => { if (open) setAcl(structuredClone(initial)); }, [open, initial]);
  function setType(type: AclType) { setAcl((current) => ({ ...current, type })); }
  function toggleRole(role: string, method: AclMethod, checked: boolean) {
    setAcl((current) => {
      const methods = new Set(current.roles[role] ?? []);
      if (checked) methods.add(method);
      else methods.delete(method);
      return { ...current, roles: { ...current.roles, [role]: [...methods] } };
    });
  }
  return (
    <OlapModal open={open} onOpenChange={closeOnRequest(onCancel)} title={`Permisos — ${path}`} size="lg" footer={<OlapModalActions onCancel={onCancel} onApply={() => onSave(acl)} applyLabel="Guardar permisos" />}>
      <div className="space-y-4">
        <OlapModalField id="acl-type" label="Visibilidad">
          <Select id="acl-type" value={acl.type} onChange={(event) => setType(event.target.value as AclType)}>
            <option value="PRIVATE">Privado</option>
            <option value="SECURED">Restringido por roles</option>
            <option value="PUBLIC">Público</option>
          </Select>
        </OlapModalField>
        {acl.type === 'SECURED' ? (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left"><tr><th className="px-3 py-2">Rol</th><th className="px-3 py-2">Leer</th><th className="px-3 py-2">Escribir</th><th className="px-3 py-2">Administrar</th></tr></thead>
              <tbody className="divide-y divide-border">
                {allRoles.map((role) => (
                  <tr key={role}>
                    <th scope="row" className="px-3 py-2 text-left font-medium">{role}</th>
                    {(['READ', 'WRITE', 'GRANT'] as const).map((method) => (
                      <td key={method} className="px-3 py-2">
                        <Checkbox checked={(acl.roles[role] ?? []).includes(method)} onCheckedChange={(checked) => toggleRole(role, method, checked === true)} aria-label={`${method} para ${role}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </OlapModal>
  );
}

export interface DashboardTemplateOption { id: string; name: string; description?: string; }
export interface NewDashboardModalProps extends BaseProps {
  defaultName: string;
  defaultFolder: string;
  folders: string[];
  templates: DashboardTemplateOption[];
  onCreate: (path: string, name: string, templateId: string | null) => void;
  folderPicker?: React.ReactNode;
}

export function NewDashboardModal({ defaultName, defaultFolder, folders, templates, onCreate, open, onCancel, folderPicker }: NewDashboardModalProps) {
  const [name, setName] = React.useState(defaultName);
  const [folder, setFolder] = React.useState(defaultFolder);
  const [templateId, setTemplateId] = React.useState<string | null>(null);
  React.useEffect(() => { if (open) { setName(defaultName); setFolder(defaultFolder); setTemplateId(null); } }, [open, defaultName, defaultFolder]);
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'dashboard';
  const normalized = normalizeFolder(folder);
  const path = `${normalized ? `${normalized}/` : ''}${slug}.saikudash`;
  return (
    <OlapModal open={open} onOpenChange={closeOnRequest(onCancel)} title="Crear dashboard" size="lg" footer={<OlapModalActions onCancel={onCancel} onApply={() => onCreate(path, name.trim(), templateId)} applyLabel="Crear dashboard" disabled={!name.trim()} />}>
      <div className="space-y-4">
        <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Comenzar desde</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[{ id: null, name: 'En blanco', description: 'Crear un dashboard vacío.' }, ...templates].map((template) => (
              <button key={template.id ?? 'blank'} type="button" onClick={() => setTemplateId(template.id)} aria-pressed={templateId === template.id} className="rounded-md border border-border bg-background p-3 text-left transition-colors hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/5">
                <span className="block text-sm font-medium">{template.name}</span>
                {template.description ? <span className="mt-1 block text-xs text-muted-foreground">{template.description}</span> : null}
              </button>
            ))}
          </div>
        </fieldset>
        <OlapModalField id="dashboard-name" label="Nombre">
          <Input id="dashboard-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
        </OlapModalField>
        {folderPicker ?? <OlapModalField id="dashboard-folder" label="Carpeta"><Select id="dashboard-folder" value={folder} onChange={(event) => setFolder(event.target.value)}>{folders.map((item) => <option key={item} value={item}>{item || '/'}</option>)}</Select></OlapModalField>}
        <p className="text-sm text-muted-foreground">Se guardará en <code className="rounded bg-muted px-1">{path}</code></p>
      </div>
    </OlapModal>
  );
}

export interface NewAppModalProps extends BaseProps {
  defaultName: string;
  defaultFolder: string;
  folders: string[];
  importing?: boolean;
  onCreate: (path: string, name: string) => void;
  folderPicker?: React.ReactNode;
}

export function NewAppModal({ defaultName, defaultFolder, folders, importing = false, onCreate, open, onCancel, folderPicker }: NewAppModalProps) {
  const [name, setName] = React.useState(defaultName);
  const [folder, setFolder] = React.useState(defaultFolder);
  React.useEffect(() => { if (open) { setName(defaultName); setFolder(defaultFolder); } }, [open, defaultName, defaultFolder]);
  const normalized = normalizeFolder(folder);
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'app';
  const path = `${normalized ? `${normalized}/` : ''}${slug}.saikuapp`;
  return (
    <OlapModal open={open} onOpenChange={closeOnRequest(onCancel)} title={importing ? 'Crear app desde dashboard' : 'Crear aplicación'} size="lg" footer={<OlapModalActions onCancel={onCancel} onApply={() => onCreate(path, name.trim())} applyLabel="Crear aplicación" disabled={!name.trim()} />}>
      <div className="space-y-4">
        {importing ? <p className="rounded-md border border-info/30 bg-info/10 p-3 text-sm">La app utilizará el dashboard seleccionado como primera página.</p> : null}
        <OlapModalField id="new-app-name" label="Nombre"><Input id="new-app-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nueva aplicación" autoComplete="off" /></OlapModalField>
        {folderPicker ?? <OlapModalField id="new-app-folder" label="Carpeta"><Select id="new-app-folder" value={folder} onChange={(event) => setFolder(event.target.value)}>{folders.map((item) => <option key={item} value={item}>{item || '/'}</option>)}</Select></OlapModalField>}
        <p className="text-sm text-muted-foreground">Ruta: <code className="rounded bg-muted px-1">{path}</code></p>
      </div>
    </OlapModal>
  );
}
