'use client';

import * as React from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@dss-monorepo/design-system';
import { createIamUser, type IamUser } from '../data-access/iam-users';

const USERNAME = /^[A-Za-z0-9._@-]{3,255}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new user once auth-service created it. */
  onCreated: (user: IamUser) => void;
}

/**
 * Creates a user in Keycloak through the BFF (IAM-006). Credentials are never typed here: by default the
 * user receives an e-mail to set the password and verify the address.
 */
export function CreateUserDialog({ open, onOpenChange, onCreated }: CreateUserDialogProps) {
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [sendInvitation, setSendInvitation] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setUsername('');
    setEmail('');
    setFirstName('');
    setLastName('');
    setSendInvitation(true);
    setError(null);
  }, [open]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!USERNAME.test(username.trim())) {
      setError('El usuario debe tener entre 3 y 255 caracteres: letras, números, punto, guion, guion bajo o @.');
      return;
    }
    if (!EMAIL.test(email.trim())) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createIamUser({ username, email, firstName, lastName, sendInvitation });
      onCreated(created);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el usuario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
          <DialogDescription>
            La cuenta se crea sin contraseña. La persona la define desde el correo de invitación.
          </DialogDescription>
        </DialogHeader>
        <form id="create-user-form" onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="new-user-username" className="text-sm font-medium">
              Usuario <span aria-hidden="true">*</span>
            </label>
            <Input
              id="new-user-username"
              required
              autoComplete="off"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="ana.perez"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="new-user-email" className="text-sm font-medium">
              Correo electrónico <span aria-hidden="true">*</span>
            </label>
            <Input
              id="new-user-email"
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ana.perez@uatf.edu.bo"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="new-user-first-name" className="text-sm font-medium">Nombres</label>
              <Input id="new-user-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new-user-last-name" className="text-sm font-medium">Apellidos</label>
              <Input id="new-user-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </div>
          </div>
          <Checkbox
            id="new-user-invitation"
            checked={sendInvitation}
            onCheckedChange={(checked) => setSendInvitation(checked === true)}
            label="Enviar invitación por correo"
            description="Pide definir la contraseña y verificar el correo. Si no la envías ahora, puedes enviarla después."
          />
          {error && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="create-user-form" loading={saving} disabled={saving}>
            Crear usuario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
