import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../atoms/button';
import { Input } from '../../atoms/input';
import { Label } from '../../atoms/label';
import { Textarea } from '../../atoms/textarea';
import type {
  AppBuilderConfig,
  AppBuilderPage,
  AppBuilderSection,
} from './types';

export interface ConfigurationPanelProps {
  app: AppBuilderConfig;
  onChange: (app: AppBuilderConfig) => void;
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AppThemePanel({ app, onChange }: ConfigurationPanelProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">Identidad visual</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Nombre y elementos de identidad de la aplicación.
        </p>
      </div>
      <Field label="Nombre de la aplicación" htmlFor="app-name">
        <Input
          id="app-name"
          value={app.name}
          onChange={(event) => onChange({ ...app, name: event.target.value })}
        />
      </Field>
      <Field label="Descripción" htmlFor="app-description">
        <Textarea
          id="app-description"
          rows={3}
          value={app.description ?? ''}
          onChange={(event) =>
            onChange({ ...app, description: event.target.value })
          }
          placeholder="¿Para qué sirve esta aplicación?"
        />
      </Field>
      <Field
        label="URL de la imagen del logotipo"
        htmlFor="app-logo"
        hint="Usa una URL de imagen confiable y accesible públicamente."
      >
        <Input
          id="app-logo"
          type="url"
          value={app.logoUrl ?? ''}
          onChange={(event) =>
            onChange({ ...app, logoUrl: event.target.value || undefined })
          }
          placeholder="https://…"
        />
      </Field>
    </div>
  );
}

export function AppHeaderPanel({ app, onChange }: ConfigurationPanelProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">Encabezado</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Define el contexto que se muestra sobre las páginas de la aplicación.
        </p>
      </div>
      <Field
        label="Texto superior"
        htmlFor="header-eyebrow"
        hint="Texto breve que aparece sobre el nombre de la aplicación."
      >
        <Input
          id="header-eyebrow"
          value={app.headerEyebrow ?? ''}
          onChange={(event) =>
            onChange({ ...app, headerEyebrow: event.target.value || undefined })
          }
          placeholder="Análisis de la unidad académica"
        />
      </Field>
    </div>
  );
}

export function AppNavigationPanel({ app, onChange }: ConfigurationPanelProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">Navegación</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige cómo navegar entre las páginas de la aplicación.
        </p>
      </div>
      <Field label="Diseño de navegación" htmlFor="app-navigation">
        <select
          id="app-navigation"
          value={app.navigation}
          onChange={(event) =>
            onChange({
              ...app,
              navigation: event.target.value as AppBuilderConfig['navigation'],
            })
          }
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        >
          {' '}
          <option value="rail">Menú lateral</option>
          <option value="top">Pestañas superiores</option>
        </select>
      </Field>
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-sm font-medium">
          {app.pages.length} {app.pages.length === 1 ? 'página' : 'páginas'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          El orden de las páginas sigue la lista del panel de páginas.
        </p>
      </div>
    </div>
  );
}

export function AppAssistantPanel({ app, onChange }: ConfigurationPanelProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">Asistente</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige si la aplicación muestra acceso al asistente de análisis.
        </p>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
        <input
          type="checkbox"
          checked={app.showAssistant}
          onChange={(event) =>
            onChange({ ...app, showAssistant: event.target.checked })
          }
          className="mt-0.5 size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span>
          <span className="block text-sm font-medium">
            Mostrar botón del asistente
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Este control puede conectarse a un asistente en una
            etapa posterior de integración.
          </span>
        </span>
      </label>
    </div>
  );
}

export function AppPagesPanel({ app, onChange }: ConfigurationPanelProps) {
  const addPage = () => {
    const page: AppBuilderPage = {
      id: `page-${Date.now()}`,
      title: `Página ${app.pages.length + 1}`,
    };
    onChange({ ...app, pages: [...app.pages, page] });
  };
  const updatePage = (id: string, title: string) =>
    onChange({
      ...app,
      pages: app.pages.map((page) =>
        page.id === id ? { ...page, title } : page,
      ),
    });
  const removePage = (id: string) =>
    onChange({ ...app, pages: app.pages.filter((page) => page.id !== id) });
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Páginas</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Asigna nombres y organiza las páginas de la aplicación.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={addPage}>
          <Plus className="size-4" />
          Agregar página
        </Button>
      </div>
      {app.pages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aún no hay páginas. Agrega una página para incluir contenido.
        </div>
      ) : (
        <ol className="space-y-3">
          {app.pages.map((page, index) => (
            <li key={page.id} className="flex items-end gap-2">
              <Field label={`Página ${index + 1}`} htmlFor={`page-${page.id}`}>
                <Input
                  id={`page-${page.id}`}
                  value={page.title}
                  onChange={(event) => updatePage(page.id, event.target.value)}
                />
              </Field>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Eliminar ${page.title}`}
                disabled={app.pages.length <= 1}
                onClick={() => removePage(page.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const panelBySection: Record<
  AppBuilderSection,
  React.ComponentType<ConfigurationPanelProps>
> = {
  theme: AppThemePanel,
  header: AppHeaderPanel,
  navigation: AppNavigationPanel,
  assistant: AppAssistantPanel,
  pages: AppPagesPanel,
};

export function AppConfigurationPanel({
  section,
  app,
  onChange,
  onClose,
}: ConfigurationPanelProps & {
  section: AppBuilderSection;
  onClose?: () => void;
}) {
  const Panel = panelBySection[section];
  const labels: Record<AppBuilderSection, string> = {
    theme: 'Identidad y tema',
    header: 'Encabezado',
    navigation: 'Navegación',
    assistant: 'Asistente',
    pages: 'Páginas',
  };
  return (
    <aside
      aria-label={`Configuración: ${labels[section]}`}
      className="flex h-full w-full flex-col border-l border-border bg-background sm:w-[22rem]"
    >
      <header className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{labels[section]}</h2>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Los cambios actualizan la vista previa de la aplicación.
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <Panel app={app} onChange={onChange} />
      </div>
    </aside>
  );
}
