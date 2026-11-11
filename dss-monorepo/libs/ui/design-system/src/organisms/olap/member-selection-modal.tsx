'use client';

import * as React from 'react';
import { Check, Filter, ListFilter, RotateCcw, Search, X } from 'lucide-react';
import { Button } from '../../atoms/button';
import { Checkbox } from '../../atoms/checkbox';
import { Input } from '../../atoms/input';
import { Loader } from '../../atoms/loader';
import { Radio } from '../../atoms/radio';
import { OlapModal } from '../olap-modals/olap-modal';
import { OlapModalActions } from '../olap-modals/modal-parts';

export interface MemberOption {
  uniqueName: string;
  name: string;
  caption?: string;
}

export interface MemberSelectionModalProps {
  open: boolean;
  onCancel: () => void;
  title?: string;
  dimensionCaption: string;
  hierarchyCaption: string;
  levelCaption?: string;
  members: MemberOption[];
  loading?: boolean;
  initialSelected?: string[];
  initialSelectionType?: 'INCLUSION' | 'EXCLUSION';
  onApply: (selected: string[], type: 'INCLUSION' | 'EXCLUSION') => void;
}

export function MemberSelectionModal({
  open,
  onCancel,
  title,
  dimensionCaption,
  hierarchyCaption,
  levelCaption,
  members,
  loading = false,
  initialSelected = [],
  initialSelectionType = 'INCLUSION',
  onApply,
}: MemberSelectionModalProps) {
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set(initialSelected));
  const [type, setType] = React.useState<'INCLUSION' | 'EXCLUSION'>(initialSelectionType);

  React.useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelected));
      setType(initialSelectionType);
      setSearch('');
    }
  }, [open, initialSelected, initialSelectionType]);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredMembers = React.useMemo(() => {
    if (!normalizedSearch) return members;
    return members.filter(
      (m) =>
        (m.caption || m.name).toLocaleLowerCase().includes(normalizedSearch) ||
        m.uniqueName.toLocaleLowerCase().includes(normalizedSearch),
    );
  }, [members, normalizedSearch]);

  const toggleMember = (uniqueName: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(uniqueName);
      else next.delete(uniqueName);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(members.map((m) => m.uniqueName)));
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  const invertSelection = () => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const m of members) {
        if (!prev.has(m.uniqueName)) next.add(m.uniqueName);
      }
      return next;
    });
  };

  const handleApply = () => {
    onApply(Array.from(selected), type);
  };

  const modalTitle =
    title ||
    `Filtrar miembros — ${levelCaption || hierarchyCaption} (${dimensionCaption})`;

  return (
    <OlapModal
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
      title={modalTitle}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {selected.size} de {members.length} seleccionados
          </span>
          <OlapModalActions
            onCancel={onCancel}
            onApply={handleApply}
            applyLabel="Aplicar filtro"
          />
        </div>
      }
    >
      <div className="space-y-4">
        {/* Selection mode toggle */}
        <fieldset className="flex items-center gap-6 rounded-md border border-border bg-muted/30 p-2.5">
          <legend className="sr-only">Tipo de selección</legend>
          <div className="flex items-center gap-2">
            <Radio
              id="mode-inclusion"
              name="selection-mode"
              checked={type === 'INCLUSION'}
              onChange={() => setType('INCLUSION')}
              label="Incluir seleccionados"
            />
          </div>
          <div className="flex items-center gap-2">
            <Radio
              id="mode-exclusion"
              name="selection-mode"
              checked={type === 'EXCLUSION'}
              onChange={() => setType('EXCLUSION')}
              label="Excluir seleccionados"
            />
          </div>
        </fieldset>

        {/* Search bar and quick actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar miembros…"
              className="pl-8"
              aria-label="Buscar miembros"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="h-8 text-xs"
            >
              Todos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={deselectAll}
              className="h-8 text-xs"
            >
              Ninguno
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={invertSelection}
              className="h-8 gap-1 text-xs"
              title="Invertir selección actual"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              <span>Invertir</span>
            </Button>
          </div>
        </div>

        {/* Member list */}
        {loading ? (
          <Loader text="Cargando miembros…" fullScreen={false} className="py-8" />
        ) : filteredMembers.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center">
            <ListFilter className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-foreground">
              No se encontraron miembros
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search ? 'Intenta con otro término de búsqueda.' : 'Este nivel no tiene miembros disponibles.'}
            </p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border/60 bg-background">
            {filteredMembers.map((member) => {
              const isChecked = selected.has(member.uniqueName);
              return (
                <div
                  key={member.uniqueName}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted/50 ${
                    isChecked ? 'bg-primary/5' : ''
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(c) => toggleMember(member.uniqueName, c === true)}
                    label={member.caption || member.name}
                  />
                  <span className="ml-auto truncate text-[0.7rem] text-muted-foreground/70">
                    {member.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </OlapModal>
  );
}
