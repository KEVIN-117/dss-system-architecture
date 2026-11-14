import * as React from 'react';
import { Eye, Pencil, Save, Settings2 } from 'lucide-react';
import { Button } from '../../atoms/button';
import { cn } from 'cn';
import { AppShell } from './app-shell';
import { AppConfigurationPanel } from './configuration-panels';
import {
  defaultAppBuilderConfig,
  type AppBuilderConfig,
  type AppBuilderSection,
} from './types';

export interface AppEditorProps {
  initialApp?: AppBuilderConfig;
  onAppChange?: (app: AppBuilderConfig) => void;
  onSave?: (app: AppBuilderConfig) => void | Promise<void>;
  saveLabel?: string;
  className?: string;
}

const sections: { id: AppBuilderSection; label: string }[] = [
  { id: 'theme', label: 'Identidad' },
  { id: 'header', label: 'Encabezado' },
  { id: 'navigation', label: 'Navegación' },
  { id: 'assistant', label: 'Asistente' },
  { id: 'pages', label: 'Páginas' },
];

/** App authoring surface. It owns local editing state; hosts own persistence and route lifecycle. */
export function AppEditor({
  initialApp = defaultAppBuilderConfig,
  onAppChange,
  onSave,
  saveLabel = 'Guardar aplicación',
  className,
}: AppEditorProps) {
  const [app, setApp] = React.useState(initialApp);
  const [activePageId, setActivePageId] = React.useState<string | undefined>(
    initialApp.pages[0]?.id,
  );
  const [editable, setEditable] = React.useState(true);
  const [section, setSection] = React.useState<AppBuilderSection | null>(
    'theme',
  );
  const [saving, setSaving] = React.useState(false);

  const updateApp = (next: AppBuilderConfig) => {
    setApp(next);
    onAppChange?.(next);
    if (!next.pages.some((page) => page.id === activePageId))
      setActivePageId(next.pages[0]?.id);
  };
  const addPage = () => {
    const next = {
      ...app,
      pages: [
        ...app.pages,
        { id: `page-${Date.now()}`, title: `Página ${app.pages.length + 1}` },
      ],
    };
    updateApp(next);
    setActivePageId(next.pages.at(-1)?.id);
    setSection('pages');
  };
  const save = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(app);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn(
        'flex min-h-[42rem] flex-col overflow-hidden rounded-xl border border-border bg-background',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 md:px-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Editor de aplicaciones
          </p>
          <h1 className="truncate text-base font-semibold">{app.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditable((value) => !value)}
            aria-pressed={!editable}
          >
            {editable ? (
              <>
                <Eye className="size-4" />
                Vista previa
              </>
            ) : (
              <>
                <Pencil className="size-4" />
                Editar
              </>
            )}
          </Button>
          {editable && (
            <Button
              variant={section ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setSection((value) => (value ? null : 'theme'))}
              aria-expanded={!!section}
            >
              <Settings2 className="size-4" />
              Configurar
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={!onSave || saving}
            loading={saving}
          >
            <Save className="size-4" />
            {saving ? 'Guardando…' : saveLabel}
          </Button>
        </div>
      </header>
      {editable && (
        <nav
          className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2"
          aria-label="Secciones de configuración de la aplicación"
        >
          {sections.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={section === item.id ? 'secondary' : 'ghost'}
              aria-pressed={section === item.id}
              onClick={() =>
                setSection((value) => (value === item.id ? null : item.id))
              }
            >
              {item.label}
            </Button>
          ))}
        </nav>
      )}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-w-0 flex-1 p-3 md:p-5">
          <AppShell
            app={app}
            activePageId={activePageId}
            onPageChange={setActivePageId}
            onAddPage={addPage}
            editable={editable}
            onEditSection={(next) => setSection(next)}
          />
        </div>
        {editable && section && (
          <div className="w-full shrink-0 border-b border-border lg:w-[22rem] lg:border-b-0">
            <AppConfigurationPanel
              section={section}
              app={app}
              onChange={updateApp}
            />
          </div>
        )}
      </div>
    </div>
  );
}
