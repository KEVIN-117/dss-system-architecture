'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown, Copy, FileCode2, ListTree, Menu, Moon, Search, Sun } from 'lucide-react';
import type { ApiOperation, ApiService } from '../lib/api-catalog';
import { apiOperationSlug } from '../lib/api-routes';
import ArchitectureGuide from '../content/arquitectura.mdx';
import IdentityGuide from '../content/identidad-y-acceso.mdx';
import DataGuide from '../content/integracion-de-datos.mdx';
import OlapGuide from '../content/analisis-olap.mdx';
import PredictionGuide from '../content/prediccion.mdx';
import StartGuide from '../content/primeros-pasos.mdx';
import ExecutiveGuide from '../content/resumen-ejecutivo.mdx';
import InventoryGuide from '../content/api-inventory.mdx';
import SetupGuide from '../content/puesta-en-marcha.mdx';
import DiagnosticsGuide from '../content/diagnostico.mdx';
import styles from './page.module.css';

type Guide = { id: string; name: string; service: 'Guías'; kind: 'guide'; summary: string };
type ApiItem = ApiOperation & { kind: 'api'; name: string; service: string; contract: string };
type Entry = Guide | ApiItem;
type Theme = 'light' | 'dark';

const themePreferenceKey = 'dss-docs-theme';

const guides: Guide[] = [
  { id: 'start', name: 'Primeros pasos', service: 'Guías', kind: 'guide', summary: 'Cómo orientarse en la documentación del DSS.' },
  { id: 'executive', name: 'Resumen ejecutivo', service: 'Guías', kind: 'guide', summary: 'Capacidades, estado y responsabilidades institucionales.' },
  { id: 'architecture', name: 'Arquitectura', service: 'Guías', kind: 'guide', summary: 'Capacidades del DSS y estado de sus componentes.' },
  { id: 'identity', name: 'Identidad y acceso', service: 'Guías', kind: 'guide', summary: 'Cómo se gestionan la sesión, los perfiles y los permisos.' },
  { id: 'data', name: 'Integración de datos', service: 'Guías', kind: 'guide', summary: 'Flujo actual de extracción, transformación y publicación.' },
  { id: 'olap', name: 'Análisis OLAP', service: 'Guías', kind: 'guide', summary: 'Consultas multidimensionales y límites conocidos.' },
  { id: 'prediction', name: 'Motor predictivo', service: 'Guías', kind: 'guide', summary: 'Capacidades implementadas y condiciones de uso.' },
  { id: 'inventory', name: 'Inventario de APIs', service: 'Guías', kind: 'guide', summary: 'Contratos disponibles y brechas documentales.' },
  { id: 'setup', name: 'Puesta en marcha local', service: 'Guías', kind: 'guide', summary: 'Preparar y arrancar el entorno de desarrollo.' },
  { id: 'diagnostics', name: 'Diagnóstico inicial', service: 'Guías', kind: 'guide', summary: 'Comprobaciones seguras para incidencias frecuentes.' },
  { id: 'administration', name: 'Administración', service: 'Guías', kind: 'guide', summary: 'Guías administrativas requieren clasificación y acceso.' },
];

const guideContent = {
  start: StartGuide,
  executive: ExecutiveGuide,
  architecture: ArchitectureGuide,
  identity: IdentityGuide,
  data: DataGuide,
  olap: OlapGuide,
  prediction: PredictionGuide,
  inventory: InventoryGuide,
  setup: SetupGuide,
  diagnostics: DiagnosticsGuide,
};

function schemaLabel(type: string) {
  return type.replaceAll('string', 'texto').replaceAll('integer', 'entero').replaceAll('number', 'número').replaceAll('boolean', 'booleano');
}

export default function Workbench({ apiCatalog }: { apiCatalog: ApiService[] }) {
  const apiItems = useMemo<ApiItem[]>(
    () => apiCatalog.flatMap((service) => service.operations.map((operation) => ({
      ...operation,
      name: operation.summary,
      service: service.name,
      kind: 'api' as const,
      contract: service.sourcePath,
    }))),
    [apiCatalog],
  );
  const entries = useMemo<Entry[]>(() => [...apiItems, ...guides], [apiItems]);
  const defaultOperation = apiItems[0];
  const [selectedId, setSelectedId] = useState(defaultOperation?.id ?? 'start');
  const [query, setQuery] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = entries.find((item) => item.id === selectedId) ?? entries[0];
  const filtered = useMemo(
    () => entries.filter((item) => `${item.service} ${item.name} ${item.summary} ${item.kind === 'api' ? `${item.method} ${item.path} ${item.tags.join(' ')}` : ''}`.toLowerCase().includes(query.toLowerCase())),
    [entries, query],
  );
  const groups = [...new Set(filtered.map((item) => item.service))];
  const GuideContent = selected.kind === 'guide'
    ? guideContent[selected.id as keyof typeof guideContent] ?? StartGuide
    : null;

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setQuery('');
        searchRef.current?.blur();
        setMobileNav(false);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const storedTheme = () => {
      try {
        const stored = window.localStorage.getItem(themePreferenceKey);
        return stored === 'dark' || stored === 'light' ? stored : null;
      } catch {
        return null;
      }
    };
    const applyTheme = (value: Theme) => {
      document.documentElement.style.colorScheme = value;
      document.documentElement.dataset.docsTheme = value;
      setTheme(value);
    };

    applyTheme(storedTheme() ?? (media.matches ? 'dark' : 'light'));
    const followSystemPreference = (event: MediaQueryListEvent) => {
      if (!storedTheme()) applyTheme(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', followSystemPreference);
    return () => media.removeEventListener('change', followSystemPreference);
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    try {
      window.localStorage.setItem(themePreferenceKey, nextTheme);
    } catch {
      // The in-memory setting still applies if browser storage is unavailable.
    }
    document.documentElement.style.colorScheme = nextTheme;
    document.documentElement.dataset.docsTheme = nextTheme;
    setTheme(nextTheme);
  };

  return (
    <main className={styles.shell} data-theme={theme}>
      <a className={styles.skipLink} href="#main-content">Saltar al contenido</a>
      <header className={styles.topbar}>
        <button className={styles.mobileMenu} type="button" aria-label={mobileNav ? 'Cerrar navegación' : 'Abrir navegación'} aria-expanded={mobileNav} onClick={() => setMobileNav(!mobileNav)}><Menu aria-hidden="true" /></button>
        <Link className={styles.brand} href="/" aria-label="DSS UATF, documentación"><span className={styles.brandMark}>D</span><span>DSS <b>UATF</b></span></Link>
        <span className={styles.divider} />
        <span className={styles.productName}>Documentación</span>
        <nav aria-label="Navegación principal" className={styles.topNav}>
          <a className={styles.topActive} href="#apis">APIs</a>
          <a href="#guides" onClick={() => setSelectedId('executive')}>Directivos</a>
          <a href="#guides" onClick={() => setSelectedId('start')}>Desarrolladores</a>
          <a href="#guides" onClick={() => setSelectedId('administration')}>Administración</a>
        </nav>
        <span className={styles.topSpacer} />
        <button className={styles.themeToggle} type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'} aria-pressed={theme === 'dark'} title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
          {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </button>
        <span className={styles.language}>ES <ChevronDown aria-hidden="true" /></span>
      </header>

      <div className={styles.workspace}>
        <aside className={`${styles.sidebar} ${mobileNav ? styles.sidebarOpen : ''}`} aria-label="Explorador de documentación">
          <div className={styles.workspaceLabel}><span className={styles.workspaceIcon}>D</span><span><b>DSS · UATF</b><small>Espacio de trabajo</small></span><ChevronDown aria-hidden="true" /></div>
          <label className={styles.searchBox}><Search aria-hidden="true" /><span className={styles.visuallyHidden}>Buscar documentación</span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en docs..." /><kbd>Ctrl K</kbd></label>
          <div className={styles.tree}>
            <a className={styles.treeRoot} href="#guides" onClick={() => setSelectedId('start')}><BookOpen aria-hidden="true" /> Guías</a>
            {groups.filter((group) => group === 'Guías').map((group) => <div className={styles.treeGroup} key={group}><p>{group}</p>{filtered.filter((item) => item.service === group).map((item) => <button className={`${styles.treeItem} ${selected.id === item.id ? styles.treeSelected : ''}`} aria-pressed={selected.id === item.id} key={item.id} onClick={() => setSelectedId(item.id)}>{item.name}</button>)}</div>)}
            <a className={styles.treeRoot} href="#apis"><ListTree aria-hidden="true" /> APIs <span className={styles.count}>{apiItems.length}</span></a>
            {groups.filter((group) => group !== 'Guías').map((group) => <div className={styles.treeGroup} key={group}><p>{group}</p>{filtered.filter((item): item is ApiItem => item.kind === 'api' && item.service === group).map((item) => <button className={`${styles.treeItem} ${selected.id === item.id ? styles.treeSelected : ''}`} aria-pressed={selected.id === item.id} key={item.id} onClick={() => setSelectedId(item.id)}><span className={styles.miniMethod}>{item.method}</span>{item.name}</button>)}</div>)}
            {filtered.length === 0 && <p className={styles.noResults}>Sin resultados para “{query}”.</p>}
          </div>
          <div className={styles.sidebarBottom}><span className={styles.statusDot} /> {apiCatalog.length} contratos OpenAPI <span>ES</span></div>
        </aside>

        <section className={styles.mainPane} id="main-content" tabIndex={-1} aria-live="polite">
          <div className={styles.breadcrumb}><span>Espacio de trabajo</span><span>/</span><span>{selected.service}</span><span>/</span><b>{selected.name}</b></div>
          <div className={styles.docHeader}>
            <div><div className={styles.eyebrow}>{selected.kind === 'api' ? `API · ${selected.service.toUpperCase()}` : 'GUÍA · DOCUMENTACIÓN'}</div><h1>{selected.name}</h1><p>{selected.summary}</p></div>
            <span className={styles.version}>{selected.kind === 'api' ? `${selected.serviceVersion} · OpenAPI` : 'MDX'}</span>
          </div>

          {selected.kind === 'api' ? <>
            <div className={styles.operation} id="apis"><span className={`${styles.method} ${selected.method !== 'GET' ? styles.methodPost : ''}`}>{selected.method}</span><code>{selected.path}</code><span className={styles.operationSummary}>{selected.tags.join(' · ')}</span><button type="button" className={styles.iconButton} aria-label="Copiar ruta del contrato" onClick={() => void navigator.clipboard?.writeText(selected.path)}><Copy aria-hidden="true" /></button></div>
            <div className={styles.docSection}><h2 id="description">Descripción</h2><p>{selected.description ?? selected.summary}</p></div>
            <div className={styles.docSection}><h2 id="authentication">Autenticación</h2><p>{selected.auth}</p>{selected.permission && <p className={styles.permission}>Permiso declarado: <code>{selected.permission}</code></p>}</div>
            <div className={styles.docSection}><h2 id="parameters">Parámetros</h2>{selected.parameters.length ? <div className={styles.parameterList}>{selected.parameters.map((parameter) => <div className={styles.parameterRow} key={`${parameter.location}-${parameter.name}`}><code>{parameter.name}</code><span>{parameter.location}</span><span>{schemaLabel(parameter.schemaType ?? 'string')}</span><span>{parameter.required ? 'Requerido' : 'Opcional'}</span>{parameter.description && <small>{parameter.description}</small>}</div>)}</div> : <p>El contrato no declara parámetros para esta operación.</p>}</div>
            <div className={styles.docSection}><h2 id="request">Cuerpo de solicitud</h2>{selected.requestContentType ? <><p>{selected.requestRequired ? 'Requerido' : 'Opcional'} · {selected.requestContentType}</p>{selected.requestFields.length ? <div className={styles.parameterList}>{selected.requestFields.map((field) => <div className={styles.parameterRow} key={field.name}><code>{field.name}</code><span>{schemaLabel(field.type)}</span><span>{field.required ? 'Requerido' : 'Opcional'}</span>{field.description && <small>{field.description}</small>}</div>)}</div> : <p>El esquema se define mediante referencias OpenAPI; abre el contrato para ver su detalle.</p>}{selected.requestExample !== undefined ? <pre className={styles.exampleCode}><code>{JSON.stringify(selected.requestExample, null, 2)}</code></pre> : <p className={styles.exampleNote}>El YAML no declara un ejemplo de solicitud; no se genera un payload de muestra.</p>}</> : <p>El contrato no define un cuerpo de solicitud.</p>}</div>
            <div className={styles.docSection}><h2 id="response">Respuestas y errores</h2><div className={styles.responseList}>{selected.responses.map((response) => <div className={styles.responseItem} key={response.status}><span className={response.status.startsWith('2') ? styles.statusCode : styles.errorCode}>{response.status}</span><span>{response.description}</span><small>{response.contentTypes.join(', ')}</small>{response.schemaFields.map((field) => <small key={field.name}><code>{field.name}</code>: {schemaLabel(field.type)}{field.required ? ' · requerido' : ''}</small>)}{response.example !== undefined ? <pre className={styles.exampleCode}><code>{JSON.stringify(response.example, null, 2)}</code></pre> : <small>Sin ejemplo declarado en YAML.</small>}</div>)}</div></div>
            <p><Link href={`/reference/${selected.serviceId}/${apiOperationSlug(selected)}`}>Abrir referencia con URL permanente ↗</Link></p>
            <div className={styles.contractNotice}><span className={styles.contractIcon}><FileCode2 aria-hidden="true" /></span><div><b>Contrato OpenAPI de origen</b><small>{selected.contract}</small></div><a className={styles.contractTag} href={`https://github.com/kevin-117/dss-system-architecture/blob/main/${selected.contract}`} target="_blank" rel="noreferrer">Abrir YAML ↗</a></div>
          </> : <article className={styles.guideContent} id="guides">{selected.id === 'administration' ? <><h2>Contenido administrativo</h2><p>Esta guía requiere una sesión institucional y el rol SUPERADMIN.</p><p><Link href="/docs/administracion">Abrir guía administrativa protegida ↗</Link></p></> : <><p><Link href={`/docs/${({ start: 'primeros-pasos', executive: 'resumen-ejecutivo', architecture: 'arquitectura', identity: 'identidad-y-acceso', data: 'integracion-de-datos', olap: 'analisis-olap', prediction: 'prediccion', inventory: 'inventario-de-apis', setup: 'puesta-en-marcha', diagnostics: 'diagnostico' } as Record<string, string>)[selected.id] ?? 'primeros-pasos'}`}>Abrir esta guía con URL permanente ↗</Link></p>{GuideContent && <GuideContent />}</>}</article>}

          <footer className={styles.docFooter}><span>¿Encontraste información desactualizada?</span><a href="https://github.com/KEVIN-117/dss-system-architecture/issues/232">Reportar un problema ↗</a><span>Fuentes versionadas en el repositorio</span></footer>
        </section>

        <aside className={styles.rightRail} aria-label="Contenido de la página"><div className={styles.railBlock}><b>En esta página</b>{selected.kind === 'api' ? <><a href="#description">Descripción</a><a href="#authentication">Autenticación</a><a href="#parameters">Parámetros</a><a href="#request">Cuerpo de solicitud</a><a href="#response">Respuestas y errores</a></> : <a href="#guides">Guía</a>}</div><div className={styles.railBlock}><b>Recursos</b>{selected.kind === 'api' && <a href={`https://github.com/kevin-117/dss-system-architecture/blob/main/${selected.contract}`} target="_blank" rel="noreferrer">Contrato de origen ↗</a>}<a href="https://spec.openapis.org/oas/latest.html" target="_blank" rel="noreferrer">Especificación OpenAPI ↗</a></div><div className={styles.railNote}><span>FUENTE DE VERDAD</span><b>Referencia sincronizada</b><p>Las operaciones, parámetros y respuestas de esta vista se leen desde los contratos YAML del repositorio.</p></div></aside>
      </div>
    </main>
  );
}
