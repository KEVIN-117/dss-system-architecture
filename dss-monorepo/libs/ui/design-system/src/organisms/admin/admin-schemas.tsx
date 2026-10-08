'use client';

import * as React from 'react';
import { Database, FileUp, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Badge } from '../../atoms/badge';
import { Button } from '../../atoms/button';
import { Input } from '../../atoms/input';
import { Skeleton } from '../../atoms/skeleton';
import { Textarea } from '../../atoms/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../molecules/dialog';
import { FormField } from '../../molecules/form-field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../molecules/table';
import type { AdminSchemaRecord } from './types';

export interface AdminSchemasProps {
  schemas: AdminSchemaRecord[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onUpload: (name: string, xml: string) => void | Promise<void>;
  onDelete: (schema: AdminSchemaRecord) => void | Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function AdminSchemas({
  schemas,
  loading = false,
  error,
  onRefresh,
  onUpload,
  onDelete,
}: AdminSchemasProps) {
  const [query, setQuery] = React.useState('');
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [xml, setXml] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [deleting, setDeleting] = React.useState<AdminSchemaRecord | null>(
    null,
  );
  const [removing, setRemoving] = React.useState(false);
  const [mutationError, setMutationError] = React.useState<string | null>(null);
  const filteredSchemas = schemas.filter((schema) =>
    `${schema.name} ${schema.path ?? ''} ${schema.type ?? ''}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  const closeUpload = () => {
    setUploadOpen(false);
    setName('');
    setXml('');
    setMutationError(null);
  };
  const pickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setName((current) => current || file.name.replace(/\.xml$/i, ''));
    setXml(await file.text());
    input.value = '';
  };
  const upload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !xml.trim()) return;
    setUploading(true);
    setMutationError(null);
    try {
      await onUpload(name.trim(), xml);
      setUploadOpen(false);
      setName('');
      setXml('');
    } catch (cause) {
      setMutationError(errorMessage(cause));
    } finally {
      setUploading(false);
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setRemoving(true);
    setMutationError(null);
    try {
      await onDelete(deleting);
      setDeleting(null);
    } catch (cause) {
      setMutationError(errorMessage(cause));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section className="space-y-6" aria-labelledby="admin-schemas-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Database className="size-4" />
            OLAP metadata
          </div>
          <h1
            id="admin-schemas-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Schemas
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Upload and manage XML schemas used by Saiku data sources.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={!onRefresh || loading}
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setMutationError(null);
              setUploadOpen(true);
            }}
          >
            <FileUp className="size-4" />
            Upload schema
          </Button>
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-medium">Schemas could not be loaded</p>
          <p className="mt-1 whitespace-pre-wrap">{error}</p>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={onRefresh}
          >
            Try again
          </Button>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="font-medium">Schema repository</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {loading
                ? 'Loading schemas…'
                : `${filteredSchemas.length} ${filteredSchemas.length === 1 ? 'schema' : 'schemas'}`}
            </p>
          </div>
          <div className="w-full sm:w-72">
            <Input
              aria-label="Search schemas"
              iconLeft={<Search className="size-4" />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or path"
            />
          </div>
        </div>
        {loading ? (
          <div className="space-y-3 p-4" aria-label="Loading schemas">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Repository path</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchemas.map((schema) => (
                <TableRow key={schema.id ?? schema.path ?? schema.name}>
                  <TableCell className="font-medium">{schema.name}</TableCell>
                  <TableCell
                    className="max-w-sm truncate font-sans text-muted-foreground"
                    title={schema.path}
                  >
                    {schema.path || '—'}
                  </TableCell>
                  <TableCell>
                    {schema.type ? (
                      <Badge variant="outline">{schema.type}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        aria-label={`Delete ${schema.name}`}
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setMutationError(null);
                          setDeleting(schema);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSchemas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-32 text-center font-sans text-muted-foreground"
                  >
                    {schemas.length === 0
                      ? 'No schemas in the repository yet.'
                      : 'No schemas match your search.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog
        open={uploadOpen}
        onOpenChange={(open: boolean) => {
          if (open) setUploadOpen(true);
          else if (!uploading) closeUpload();
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload schema</DialogTitle>
            <DialogDescription>
              Choose an XML file or paste its content. The schema name
              determines its repository entry.
            </DialogDescription>
          </DialogHeader>
          <form
            id="admin-schema-upload"
            onSubmit={(event) => void upload(event)}
            className="space-y-4"
          >
            <FormField label="Schema name" htmlFor="admin-schema-name" required>
              <Input
                id="admin-schema-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Academic"
                required
              />
            </FormField>
            <FormField
              label="XML file"
              htmlFor="admin-schema-file"
              description="Only XML files can be selected. You can review or edit the content before uploading."
            >
              <Input
                id="admin-schema-file"
                type="file"
                accept=".xml,application/xml,text/xml"
                onChange={(event) => void pickFile(event)}
                className="h-auto py-2 file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-xs file:font-medium file:text-secondary-foreground"
              />
            </FormField>
            <FormField label="XML content" htmlFor="admin-schema-xml" required>
              <Textarea
                id="admin-schema-xml"
                value={xml}
                onChange={(event) => setXml(event.target.value)}
                rows={12}
                spellCheck={false}
                className="font-mono text-xs"
                placeholder={'<Schema name="Academic">…</Schema>'}
                required
              />
            </FormField>
            {mutationError && (
              <p
                role="alert"
                className="whitespace-pre-wrap text-sm text-destructive"
              >
                {mutationError}
              </p>
            )}
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeUpload}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="admin-schema-upload"
              loading={uploading}
              disabled={!name.trim() || !xml.trim()}
            >
              Upload schema
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open: boolean) => {
          if (!open && !removing) {
            setDeleting(null);
            setMutationError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete schema?</DialogTitle>
            <DialogDescription>
              Deleting <strong>{deleting?.name}</strong> can prevent data
              sources and cubes using it from loading.
            </DialogDescription>
          </DialogHeader>
          {mutationError && (
            <p
              role="alert"
              className="whitespace-pre-wrap text-sm text-destructive"
            >
              {mutationError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void remove()}
              loading={removing}
            >
              Delete schema
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
