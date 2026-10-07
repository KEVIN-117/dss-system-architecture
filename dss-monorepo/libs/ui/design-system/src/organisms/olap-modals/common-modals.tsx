'use client';

import * as React from 'react';
import { Button } from '../../atoms/button';
import { Input } from '../../atoms/input';
import { Select } from '../../atoms/select';
import { Textarea } from '../../atoms/textarea';
import { OlapModal } from './olap-modal';
import { OlapModalActions, OlapModalField } from './modal-parts';

interface ModalProps {
  open: boolean;
  onCancel: () => void;
  title?: React.ReactNode;
}

const closeOnRequest = (onCancel: () => void) => (open: boolean) => {
  if (!open) onCancel();
};

export interface ConfirmModalProps extends ModalProps {
  title: React.ReactNode;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  open,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <OlapModal
      open={open}
      onOpenChange={closeOnRequest(onCancel)}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-foreground">{message}</p>
    </OlapModal>
  );
}

export interface WarningModalProps extends ModalProps {
  message: React.ReactNode;
  okLabel?: string;
}

export function WarningModal({
  title = 'Advertencia',
  message,
  okLabel = 'Entendido',
  open,
  onCancel,
}: WarningModalProps) {
  return (
    <OlapModal
      open={open}
      onOpenChange={closeOnRequest(onCancel)}
      title={title}
      size="sm"
      footer={<Button onClick={onCancel}>{okLabel}</Button>}
    >
      <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
        {message}
      </div>
    </OlapModal>
  );
}

export interface AddFolderModalProps extends ModalProps {
  parentPath: string;
  nameLabel?: string;
  onCreate: (name: string) => void;
}

export function AddFolderModal({
  parentPath,
  nameLabel = 'Nombre de la carpeta',
  open,
  onCreate,
  onCancel,
}: AddFolderModalProps) {
  const [name, setName] = React.useState('');
  React.useEffect(() => {
    if (open) setName('');
  }, [open]);

  return (
    <OlapModal
      open={open}
      onOpenChange={closeOnRequest(onCancel)}
      title="Crear carpeta"
      size="sm"
      footer={
        <OlapModalActions
          onCancel={onCancel}
          onApply={() => onCreate(name.trim())}
          applyLabel="Crear"
          disabled={!name.trim()}
        />
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Se creará dentro de{' '}
          <code className="rounded bg-muted px-1">{parentPath || '/'}</code>.
        </p>
        <OlapModalField id="folder-name" label={nameLabel}>
          <Input
            id="folder-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </OlapModalField>
      </div>
    </OlapModal>
  );
}

export interface RenameFolderModalProps extends ModalProps {
  folderPath: string;
  onRename: (newName: string) => void;
  validateName?: (name: string) => string | null;
  nameLabel?: string;
}

export function RenameFolderModal({
  folderPath,
  onRename,
  onCancel,
  open,
  validateName,
  nameLabel = 'Nombre de la carpeta',
}: RenameFolderModalProps) {
  const pathParts = folderPath.split('/').filter(Boolean);
  const initialName = pathParts[pathParts.length - 1] ?? '';
  const [name, setName] = React.useState(initialName);
  React.useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);
  const error = validateName?.(name.trim()) ?? null;
  const valid = !!name.trim() && name.trim() !== initialName && error == null;

  return (
    <OlapModal
      open={open}
      onOpenChange={closeOnRequest(onCancel)}
      title="Renombrar carpeta"
      size="sm"
      footer={
        <OlapModalActions
          onCancel={onCancel}
          onApply={() => onRename(name.trim())}
          applyLabel="Guardar"
          disabled={!valid}
        />
      }
    >
      <div className="space-y-4">
        <p className="break-all text-sm text-muted-foreground">{folderPath}</p>
        <OlapModalField id="rename-folder" label={nameLabel} error={error}>
          <Input
            id="rename-folder"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </OlapModalField>
      </div>
    </OlapModal>
  );
}

export interface MoveRepositoryObjectProps extends ModalProps {
  sourcePath: string;
  folders: string[];
  onMove: (targetFolder: string) => void;
  destinationLabel?: string;
}

export function MoveRepositoryObject({
  sourcePath,
  folders,
  onMove,
  onCancel,
  open,
  destinationLabel = 'Carpeta de destino',
}: MoveRepositoryObjectProps) {
  const [target, setTarget] = React.useState(folders[0] ?? '');
  React.useEffect(() => {
    if (open) setTarget(folders[0] ?? '');
  }, [open, folders]);

  return (
    <OlapModal
      open={open}
      onOpenChange={closeOnRequest(onCancel)}
      title="Mover elemento"
      size="md"
      footer={
        <OlapModalActions
          onCancel={onCancel}
          onApply={() => onMove(target)}
          applyLabel="Mover"
          disabled={!folders.length}
        />
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Mover <code>{sourcePath}</code>.
        </p>
        <OlapModalField id="move-destination" label={destinationLabel}>
          <Select
            id="move-destination"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            {folders.map((folder) => (
              <option value={folder} key={folder}>
                {folder || '/'}
              </option>
            ))}
          </Select>
        </OlapModalField>
      </div>
    </OlapModal>
  );
}

export interface ReportTitles {
  title: string;
  subtitle: string;
  notes: string;
}

export interface ReportTitlesModalProps extends ModalProps {
  titles: ReportTitles;
  onSave: (titles: ReportTitles) => void;
}

export function ReportTitlesModal({
  titles,
  onSave,
  onCancel,
  open,
}: ReportTitlesModalProps) {
  const [form, setForm] = React.useState(titles);
  React.useEffect(() => {
    if (open) setForm(titles);
  }, [open, titles]);
  const update = (key: keyof ReportTitles) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <OlapModal
      open={open}
      onOpenChange={closeOnRequest(onCancel)}
      title="Títulos del informe"
      size="md"
      footer={
        <OlapModalActions
          onCancel={onCancel}
          onApply={() => onSave(form)}
          applyLabel="Guardar"
        />
      }
    >
      <div className="space-y-4">
        <OlapModalField id="report-title" label="Título">
          <Input
            id="report-title"
            value={form.title}
            onChange={(event) => update('title')(event.target.value)}
          />
        </OlapModalField>
        <OlapModalField id="report-subtitle" label="Subtítulo">
          <Input
            id="report-subtitle"
            value={form.subtitle}
            onChange={(event) => update('subtitle')(event.target.value)}
          />
        </OlapModalField>
        <OlapModalField id="report-notes" label="Notas">
          <Textarea
            id="report-notes"
            value={form.notes}
            onChange={(event) => update('notes')(event.target.value)}
            rows={4}
          />
        </OlapModalField>
      </div>
    </OlapModal>
  );
}
