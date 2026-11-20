'use client';

import * as React from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@dss-monorepo/design-system';
import { TriangleAlert } from 'lucide-react';
import { IamRequestError } from '../data-access/iam-users';

interface DeleteInUseDialogProps {
  /** `rol` or `permiso`, for the copy. */
  kind: string;
  /** What is being deleted; `null` closes the dialog. */
  name: string | null;
  /** Deletes; with `force` auth-service also removes it from every role and user. */
  onDelete: (name: string, force: boolean) => Promise<void>;
  onDeleted: (name: string) => void;
  onClose: () => void;
}

/**
 * Two-step deletion: auth-service refuses (409) to delete something still in use and says where; the
 * dialog then shows that warning and only a second, explicit confirmation deletes it anyway (`force`).
 */
export function DeleteInUseDialog({ kind, name, onDelete, onDeleted, onClose }: DeleteInUseDialogProps) {
  const [busy, setBusy] = React.useState(false);
  const [inUse, setInUse] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setInUse(null);
    setError(null);
  }, [name]);

  const remove = async (force: boolean) => {
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(name, force);
      onDeleted(name);
      onClose();
    } catch (cause) {
      if (!force && cause instanceof IamRequestError && cause.status === 409) {
        setInUse(cause.message);
      } else {
        setError(cause instanceof Error ? cause.message : `No se pudo eliminar el ${kind}.`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={name !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{inUse ? `El ${kind} está en uso` : `¿Eliminar el ${kind} ${name ?? ''}?`}</DialogTitle>
          <DialogDescription>
            {inUse
              ? 'Si lo eliminas igualmente, se quita de todos los roles y usuarios que lo tienen. No se puede deshacer.'
              : 'Se elimina de Keycloak. No se puede deshacer.'}
          </DialogDescription>
        </DialogHeader>
        {inUse && (
          <p role="alert" className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{inUse}</span>
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="button" variant="destructive" loading={busy} disabled={busy} onClick={() => void remove(inUse !== null)}>
            {inUse ? 'Eliminar de todas formas' : 'Eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
