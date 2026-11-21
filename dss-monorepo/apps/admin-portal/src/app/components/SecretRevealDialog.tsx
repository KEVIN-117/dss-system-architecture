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
  Input,
} from '@dss-monorepo/design-system';
import { Check, Copy, TriangleAlert } from 'lucide-react';

interface SecretRevealDialogProps {
  /** `null` closes the dialog and drops the secret from memory. */
  secret: { clientId: string; value: string } | null;
  onClose: () => void;
}

/**
 * Shows a client secret the only time the platform returns it. It is not stored anywhere: closing the
 * dialog forgets it, so the copy has to happen here.
 */
export function SecretRevealDialog({ secret, onClose }: SecretRevealDialogProps) {
  const [copied, setCopied] = React.useState<'ok' | 'failed' | null>(null);

  React.useEffect(() => setCopied(null), [secret]);

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.value);
      setCopied('ok');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <Dialog open={secret !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Secreto de {secret?.clientId ?? ''}</DialogTitle>
          <DialogDescription>
            Cópialo y guárdalo en el gestor de secretos de la aplicación. No se volverá a mostrar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="client-secret" className="text-sm font-medium">Secreto</label>
          <div className="flex gap-2">
            <Input
              id="client-secret"
              readOnly
              value={secret?.value ?? ''}
              className="font-mono text-xs"
              onFocus={(event) => event.target.select()}
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="button" variant="outline" onClick={() => void copy()}>
              {copied === 'ok' ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
              {copied === 'ok' ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
          {copied === 'failed' && (
            <p role="alert" className="text-sm text-destructive">
              No se pudo copiar automáticamente; selecciona el texto y cópialo a mano.
            </p>
          )}
          <p className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>Al cerrar esta ventana el secreto se descarta. Si lo pierdes, tendrás que rotarlo.</span>
          </p>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose}>Ya lo guardé</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
