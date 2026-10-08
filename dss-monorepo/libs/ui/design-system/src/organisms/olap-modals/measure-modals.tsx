'use client';

import * as React from 'react';
import { Badge } from '../../atoms/badge';
import { Button } from '../../atoms/button';
import { Checkbox } from '../../atoms/checkbox';
import { Input } from '../../atoms/input';
import { OlapModal } from './olap-modal';

export interface OlapMeasure {
  uniqueName: string;
  name: string;
  caption?: string;
  calculated?: boolean;
  visible?: boolean;
}

export interface MeasuresModalProps {
  available: OlapMeasure[];
  selectedUniqueNames: string[];
  open: boolean;
  onSave: (uniqueNames: string[]) => void;
  onCancel: () => void;
  isAdmin?: boolean;
  showHidden?: boolean;
  onIncludeHiddenChange?: (includeHidden: boolean) => void;
  refreshing?: boolean;
  title?: React.ReactNode;
}

export function MeasuresModal({
  available,
  selectedUniqueNames,
  open,
  onSave,
  onCancel,
  isAdmin = false,
  showHidden = false,
  onIncludeHiddenChange,
  refreshing = false,
  title = 'Medidas',
}: MeasuresModalProps) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set(selectedUniqueNames));
  const [search, setSearch] = React.useState('');
  const [includeHidden, setIncludeHidden] = React.useState(showHidden);
  React.useEffect(() => {
    if (open) {
      setSelected(new Set(selectedUniqueNames));
      setSearch('');
      setIncludeHidden(showHidden);
    }
  }, [open, selectedUniqueNames, showHidden]);

  const filtered = available.filter((measure) =>
    !search || (measure.caption || measure.name).toLowerCase().includes(search.toLowerCase()),
  );
  function toggle(uniqueName: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(uniqueName);
      else next.delete(uniqueName);
      return next;
    });
  }
  function changeHidden(checked: boolean) {
    setIncludeHidden(checked);
    onIncludeHiddenChange?.(checked);
  }

  return (
    <OlapModal
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onSave([...selected])}>Guardar selección</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar medidas…" aria-label="Filtrar medidas" />
        {isAdmin ? (
          <div className="rounded-md border border-dashed border-border p-3">
            <Checkbox
              checked={includeHidden}
              onCheckedChange={(checked: boolean | 'indeterminate') => changeHidden(checked === true)}
              label="Mostrar medidas ocultas"
              description="Solicita al servidor que incluya medidas no visibles."
            />
          </div>
        ) : null}
        {refreshing ? <p className="text-sm text-muted-foreground" role="status">Actualizando medidas…</p> : null}
        <ul className="max-h-[50vh] divide-y divide-border overflow-auto rounded-md border border-border">
          {filtered.map((measure) => (
            <li key={measure.uniqueName} className="flex items-center gap-3 px-3 py-2">
              <Checkbox
                checked={selected.has(measure.uniqueName)}
                onCheckedChange={(checked: boolean | 'indeterminate') => toggle(measure.uniqueName, checked === true)}
                label={measure.caption || measure.name}
              />
              {measure.calculated ? <Badge variant="outline">Calculada</Badge> : null}
              {measure.visible === false ? <Badge variant="secondary">Oculta</Badge> : null}
            </li>
          ))}
          {filtered.length === 0 ? <li className="p-4 text-center text-sm text-muted-foreground">No se encontraron medidas.</li> : null}
        </ul>
      </div>
    </OlapModal>
  );
}

export type SelectionType = 'INCLUSION' | 'EXCLUSION';
export interface LevelSelection {
  levelName: string;
  selected: string[];
  type: SelectionType;
}
export interface OlapMember {
  uniqueName: string;
  name: string;
  caption?: string;
}
export interface SelectionsModalProps {
  hierarchyCaption: string;
  levelNames: string[];
  initialPerLevel: Record<string, { selected: string[]; type: SelectionType }>;
  initialLevelName: string;
  open: boolean;
  showDateFilter?: boolean;
  loadMembers: (levelName: string) => Promise<OlapMember[]>;
  onSave: (selections: LevelSelection[]) => void;
  onOpenDateFilter: () => void;
  onCancel: () => void;
}

type LevelState = { selected: Set<string>; type: SelectionType };

export function SelectionsModal({
  hierarchyCaption,
  levelNames,
  initialPerLevel,
  initialLevelName,
  open,
  showDateFilter = true,
  loadMembers,
  onSave,
  onOpenDateFilter,
  onCancel,
}: SelectionsModalProps) {
  const [activeLevel, setActiveLevel] = React.useState(initialLevelName);
  const [stateByLevel, setStateByLevel] = React.useState<Record<string, LevelState>>({});
  const [membersByLevel, setMembersByLevel] = React.useState<Record<string, OlapMember[]>>({});
  const [loadingLevel, setLoadingLevel] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  React.useEffect(() => {
    if (open) {
      setActiveLevel(initialLevelName);
      setStateByLevel(Object.fromEntries(levelNames.map((level) => [level, {
        selected: new Set(initialPerLevel[level]?.selected ?? []),
        type: initialPerLevel[level]?.type ?? 'INCLUSION',
      }])));
      setMembersByLevel({});
      setLoadError(null);
      setSearch('');
    }
  }, [open, initialLevelName, initialPerLevel, levelNames]);

  React.useEffect(() => {
    if (!open || !activeLevel || membersByLevel[activeLevel] || loadingLevel === activeLevel) return;
    let cancelled = false;
    setLoadingLevel(activeLevel);
    setLoadError(null);
    loadMembers(activeLevel)
      .then((members) => { if (!cancelled) setMembersByLevel((current) => ({ ...current, [activeLevel]: members })); })
      .catch((error: unknown) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (!cancelled) setLoadingLevel(null); });
    return () => { cancelled = true; };
  }, [open, activeLevel, membersByLevel, loadingLevel, loadMembers]);

  const activeState = stateByLevel[activeLevel] ?? { selected: new Set<string>(), type: 'INCLUSION' as const };
  const visibleMembers = (membersByLevel[activeLevel] ?? []).filter((member) =>
    !search || (member.caption || member.name).toLowerCase().includes(search.toLowerCase()),
  );
  function updateActive(update: (current: LevelState) => LevelState) {
    setStateByLevel((current) => ({
      ...current,
      [activeLevel]: update(current[activeLevel] ?? { selected: new Set(), type: 'INCLUSION' }),
    }));
  }
  function save() {
    onSave(levelNames.map((level) => ({
      levelName: level,
      selected: [...(stateByLevel[level]?.selected ?? new Set(initialPerLevel[level]?.selected ?? []))],
      type: stateByLevel[level]?.type ?? initialPerLevel[level]?.type ?? 'INCLUSION',
    })));
  }

  return (
    <OlapModal
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}
      title={`Selección de miembros — ${hierarchyCaption}`}
      size="lg"
      footer={
        <>
          {showDateFilter ? <Button variant="outline" className="mr-auto" onClick={onOpenDateFilter}>Abrir filtro de fechas</Button> : null}
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={save}>Aplicar selección</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Niveles de jerarquía">
          {levelNames.map((level) => (
            <Button key={level} type="button" size="sm" variant={activeLevel === level ? 'secondary' : 'outline'} role="tab" aria-selected={activeLevel === level} onClick={() => { setActiveLevel(level); setSearch(''); }}>
              {level}
            </Button>
          ))}
        </div>
        <div className="flex gap-2" role="group" aria-label="Modo de selección">
          <Button type="button" size="sm" variant={activeState.type === 'INCLUSION' ? 'secondary' : 'outline'} onClick={() => updateActive((current) => ({ ...current, type: 'INCLUSION' }))}>Incluir</Button>
          <Button type="button" size="sm" variant={activeState.type === 'EXCLUSION' ? 'secondary' : 'outline'} onClick={() => updateActive((current) => ({ ...current, type: 'EXCLUSION' }))}>Excluir</Button>
        </div>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar miembros…" aria-label="Buscar miembros" />
        {loadingLevel === activeLevel ? <p className="text-sm text-muted-foreground" role="status">Cargando miembros…</p> : null}
        {loadError ? <p className="text-sm text-destructive" role="alert">{loadError}</p> : null}
        <ul className="max-h-[45vh] divide-y divide-border overflow-auto rounded-md border border-border">
          {visibleMembers.map((member) => (
            <li key={member.uniqueName} className="px-3 py-2">
              <Checkbox
                checked={activeState.selected.has(member.uniqueName)}
                onCheckedChange={(checked: boolean | 'indeterminate') => updateActive((current) => {
                  const selected = new Set(current.selected);
                  if (checked === true) selected.add(member.uniqueName);
                  else selected.delete(member.uniqueName);
                  return { ...current, selected };
                })}
                label={member.caption || member.name}
              />
            </li>
          ))}
        </ul>
      </div>
    </OlapModal>
  );
}
