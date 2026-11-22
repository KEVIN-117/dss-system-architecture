'use client';

import * as React from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Loader,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@dss-monorepo/design-system';
import { Eye, KeyRound, Pencil, Plus, RefreshCw, Search } from 'lucide-react';
import { useHasPermission } from '@dss-monorepo/rbac';
import {
  CLIENT_ID_PATTERN,
  EDITABLE_SYSTEM_CLIENT,
  MAX_URIS,
  canRotateSecret,
  createClient,
  isEditable,
  listClients,
  parseUriList,
  rotateClientSecret,
  updateClient,
  type IamClient,
  type IamClientType,
} from '../data-access/iam-clients';
import { SecretRevealDialog } from './SecretRevealDialog';

const TYPE_LABELS: Readonly<Record<IamClientType, string>> = {
  PUBLIC: 'Pública',
  CONFIDENTIAL: 'Confidencial',
  BEARER_ONLY: 'Solo validación',
};

type Revealed = { clientId: string; value: string };

/** Applications registered in Keycloak (IAM-018); platform clients are protected and read-only. */
export function AdminClientsPage() {
  const canWrite = useHasPermission('iam:clients:write');
  const [clients, setClients] = React.useState<IamClient[]>([]);
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<IamClient | 'new' | null>(null);
  const [rotating, setRotating] = React.useState<IamClient | null>(null);
  const [revealed, setRevealed] = React.useState<Revealed | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const result = await listClients(search, signal);
        setClients(
          [...result].sort((left, right) =>
            left.clientId.localeCompare(right.clientId),
          ),
        );
      } catch (cause) {
        if (signal?.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudieron cargar las aplicaciones.',
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [search],
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  console.log(clients);

  return (
    <section className="space-y-6" aria-labelledby="admin-clients-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Administración · servicio de autenticación
          </p>
          <h1
            id="admin-clients-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Aplicaciones
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Aplicaciones que inician sesión o validan tokens con Keycloak. Las
            marcadas como protegidas sostienen la plataforma y no se modifican
            desde aquí.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Actualizar
          </Button>
          {canWrite && (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden="true" className="size-4" />
              Nueva aplicación
            </Button>
          )}
        </div>
      </header>

      <form
        role="search"
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchInput.trim());
        }}
      >
        <div className="w-full space-y-1.5 sm:w-72">
          <label htmlFor="client-search" className="text-sm font-medium">
            Buscar por identificador
          </label>
          <Input
            id="client-search"
            maxLength={64}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="portal-becas"
            iconLeft={<Search aria-hidden="true" className="size-4" />}
          />
        </div>
        <Button type="submit">Buscar</Button>
      </form>

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3 text-sm"
        >
          <p>{notice}</p>
          <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>
            Cerrar aviso
          </Button>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-medium">No se pudieron cargar las aplicaciones</p>
          <p className="mt-1">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void load()}
          >
            Reintentar
          </Button>
        </div>
      )}

      <div
        className="rounded-xl border border-border bg-card"
        aria-busy={loading}
      >
        <Table aria-label="Aplicaciones registradas">
          <TableHeader>
            <TableRow>
              <TableHead>Aplicación</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((item) => {
              const editable = canWrite && isEditable(item);
              return (
                <TableRow key={item.clientId}>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2 font-mono text-sm">
                      {item.clientId}
                      {item.system && (
                        <Badge variant="outline">Protegida</Badge>
                      )}
                    </span>
                    {item.name && (
                      <span className="block font-sans text-xs text-muted-foreground">
                        {item.name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-sans text-sm">
                    {TYPE_LABELS[item.type] ?? item.type}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.enabled ? 'secondary' : 'outline'}>
                      {item.enabled ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${editable ? 'Editar' : 'Ver'} ${item.clientId}`}
                        onClick={() => setEditing(item)}
                      >
                        {editable ? (
                          <Pencil aria-hidden="true" className="size-4" />
                        ) : (
                          <Eye aria-hidden="true" className="size-4" />
                        )}
                      </Button>
                      {canWrite && canRotateSecret(item) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Rotar secreto de ${item.clientId}`}
                          onClick={() => setRotating(item)}
                        >
                          <KeyRound aria-hidden="true" className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && clients.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center font-sans text-muted-foreground"
                >
                  {error
                    ? 'Verifica la conexión e inténtalo de nuevo.'
                    : 'No hay aplicaciones que coincidan.'}
                </TableCell>
              </TableRow>
            )}
            {loading && clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} role="status">
                  <Loader
                    text="Cargando aplicaciones…"
                    fullScreen={false}
                    className="min-h-24"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ClientFormDialog
        client={editing}
        canWrite={canWrite}
        onClose={() => setEditing(null)}
        onSaved={(saved, secret) => {
          setNotice(
            editing === 'new'
              ? `Aplicación ${saved.clientId} registrada.`
              : `Aplicación ${saved.clientId} actualizada.`,
          );
          if (secret) setRevealed({ clientId: saved.clientId, value: secret });
          void load();
        }}
      />
      <RotateSecretDialog
        client={rotating}
        onClose={() => setRotating(null)}
        onRotated={(issued) => {
          setNotice(
            `Secreto de ${issued.clientId} rotado. El anterior ya no es válido.`,
          );
          setRevealed({ clientId: issued.clientId, value: issued.secret });
        }}
      />
      <SecretRevealDialog secret={revealed} onClose={() => setRevealed(null)} />
    </section>
  );
}

function UriField({
  id,
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Textarea
        id={id}
        rows={2}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="font-mono text-xs"
        aria-describedby={`${id}-hint`}
        spellCheck={false}
      />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

function ClientFormDialog({
  client,
  canWrite,
  onClose,
  onSaved,
}: {
  client: IamClient | 'new' | null;
  canWrite: boolean;
  onClose: () => void;
  onSaved: (client: IamClient, secret: string | null) => void;
}) {
  const creating = client === 'new';
  const existing = client === 'new' ? null : client;
  const readOnly =
    !creating && (!canWrite || (existing !== null && !isEditable(existing)));
  const canToggle = creating || existing?.clientId !== EDITABLE_SYSTEM_CLIENT;
  const [clientId, setClientId] = React.useState('');
  const [type, setType] = React.useState<'PUBLIC' | 'CONFIDENTIAL'>(
    'CONFIDENTIAL',
  );
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [enabled, setEnabled] = React.useState(true);
  const [serviceAccounts, setServiceAccounts] = React.useState(false);
  const [redirectUris, setRedirectUris] = React.useState('');
  const [webOrigins, setWebOrigins] = React.useState('');
  const [logoutUris, setLogoutUris] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (client === null) return;
    const item = client === 'new' ? null : client;
    setClientId(item?.clientId ?? '');
    setType('CONFIDENTIAL');
    setName(item?.name ?? '');
    setDescription(item?.description ?? '');
    setEnabled(item?.enabled ?? true);
    setServiceAccounts(item?.serviceAccountsEnabled ?? false);
    setRedirectUris((item?.redirectUris ?? []).join('\n'));
    setWebOrigins((item?.webOrigins ?? []).join('\n'));
    setLogoutUris((item?.postLogoutRedirectUris ?? []).join('\n'));
    setError(null);
  }, [client]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) return;
    const uris = {
      redirectUris: parseUriList(redirectUris),
      webOrigins: parseUriList(webOrigins),
      postLogoutRedirectUris: parseUriList(logoutUris),
    };
    if (creating && !CLIENT_ID_PATTERN.test(clientId.trim())) {
      setError(
        'El identificador usa minúsculas, números y guion, empieza con una letra y tiene de 3 a 64 caracteres.',
      );
      return;
    }
    if (
      Object.values(uris).some(
        (list) =>
          list.length > MAX_URIS || list.some((uri) => uri.length > 500),
      )
    ) {
      setError(
        `Cada lista admite hasta ${MAX_URIS} URIs de 500 caracteres como máximo.`,
      );
      return;
    }
    const isPublic = creating ? type === 'PUBLIC' : existing?.type === 'PUBLIC';
    if (isPublic && uris.redirectUris.length === 0) {
      setError(
        'Una aplicación pública necesita al menos una URI de redirección.',
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (creating) {
        const created = await createClient({
          clientId,
          type,
          name,
          description,
          enabled,
          serviceAccountsEnabled: serviceAccounts,
          ...uris,
        });
        onSaved(created.client, created.secret);
      } else if (existing) {
        const updated = await updateClient(existing.clientId, {
          name,
          description,
          ...(canToggle ? { enabled } : {}),
          ...uris,
        });
        onSaved(updated, null);
      }
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo guardar la aplicación.',
      );
    } finally {
      setSaving(false);
    }
  };

  const title = creating
    ? 'Nueva aplicación'
    : `${readOnly ? '' : 'Editar '}${existing?.clientId ?? ''}`;
  const disabled = readOnly || saving;

  return (
    <Dialog
      open={client !== null}
      onOpenChange={(open) => !open && !saving && onClose()}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {creating &&
              'El identificador y el tipo no se pueden cambiar después.'}
            {!creating &&
              readOnly &&
              existing?.system &&
              'Aplicación protegida: la plataforma depende de ella y es de solo lectura.'}
            {!creating &&
              readOnly &&
              !existing?.system &&
              'Vista de solo lectura.'}
            {!creating &&
              !readOnly &&
              existing?.clientId === EDITABLE_SYSTEM_CLIENT &&
              'Aplicación protegida: puedes cambiar nombre, descripción y URIs, pero no desactivarla.'}
            {!creating &&
              !readOnly &&
              existing?.clientId !== EDITABLE_SYSTEM_CLIENT &&
              `Tipo ${TYPE_LABELS[existing?.type ?? 'CONFIDENTIAL'].toLowerCase()}. El identificador y el tipo no se pueden cambiar.`}
          </DialogDescription>
        </DialogHeader>
        <form
          id="client-form"
          onSubmit={(event) => void submit(event)}
          className="space-y-4"
          noValidate
        >
          {creating && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="client-id" className="text-sm font-medium">
                  Identificador <span aria-hidden="true">*</span>
                </label>
                <Input
                  id="client-id"
                  required
                  value={clientId}
                  onChange={(event) =>
                    setClientId(event.target.value.toLowerCase())
                  }
                  placeholder="portal-becas"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="client-type" className="text-sm font-medium">
                  Tipo
                </label>
                <Select
                  id="client-type"
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as 'PUBLIC' | 'CONFIDENTIAL')
                  }
                >
                  <option value="CONFIDENTIAL">
                    Confidencial (con secreto)
                  </option>
                  <option value="PUBLIC">Pública (navegador, PKCE)</option>
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="client-name" className="text-sm font-medium">
              Nombre
            </label>
            <Input
              id="client-name"
              maxLength={255}
              value={name}
              disabled={disabled}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="client-description" className="text-sm font-medium">
              Descripción
            </label>
            <Input
              id="client-description"
              maxLength={255}
              value={description}
              disabled={disabled}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <UriField
            id="client-redirect-uris"
            label="URIs de redirección"
            hint="Una por línea. Obligatoria para aplicaciones públicas."
            value={redirectUris}
            onChange={setRedirectUris}
            disabled={disabled}
          />
          <UriField
            id="client-web-origins"
            label="Orígenes web (CORS)"
            hint="Una por línea, por ejemplo https://becas.uatf.edu.bo."
            value={webOrigins}
            onChange={setWebOrigins}
            disabled={disabled}
          />
          <UriField
            id="client-logout-uris"
            label="URIs tras cerrar sesión"
            hint="Una por línea."
            value={logoutUris}
            onChange={setLogoutUris}
            disabled={disabled}
          />
          {canToggle && (
            <Checkbox
              id="client-enabled"
              checked={enabled}
              disabled={disabled}
              onCheckedChange={(checked) => setEnabled(checked === true)}
              label="Aplicación activa"
              description="Una aplicación inactiva no puede iniciar sesión ni obtener tokens."
            />
          )}
          {creating && type === 'CONFIDENTIAL' && (
            <Checkbox
              id="client-service-account"
              checked={serviceAccounts}
              disabled={disabled}
              onCheckedChange={(checked) =>
                setServiceAccounts(checked === true)
              }
              label="Cuenta de servicio"
              description="Permite que la aplicación obtenga tokens propios (client credentials), sin usuario."
            />
          )}
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            {readOnly ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!readOnly && (
            <Button
              type="submit"
              form="client-form"
              loading={saving}
              disabled={saving}
            >
              {creating ? 'Registrar aplicación' : 'Guardar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RotateSecretDialog({
  client,
  onClose,
  onRotated,
}: {
  client: IamClient | null;
  onClose: () => void;
  onRotated: (issued: { clientId: string; secret: string }) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => setError(null), [client]);

  const rotate = async () => {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      const issued = await rotateClientSecret(client.clientId);
      onClose();
      onRotated(issued);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudo rotar el secreto.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={client !== null}
      onOpenChange={(open) => !open && !busy && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            ¿Rotar el secreto de {client?.clientId ?? ''}?
          </DialogTitle>
          <DialogDescription>
            El secreto actual deja de valer de inmediato: la aplicación fallará
            hasta que configures el nuevo.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={busy}
            disabled={busy}
            onClick={() => void rotate()}
          >
            Rotar secreto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
