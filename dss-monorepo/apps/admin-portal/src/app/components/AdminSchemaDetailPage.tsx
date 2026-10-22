'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  OlapSchemaViewer,
  type OlapSchemaViewModel,
} from '@dss-monorepo/design-system';
import { getOlapSchemaXml } from '../data-access/olap-admin';
import { parseMondrianSchema } from '../data-access/mondrian-schema';

export function AdminSchemaDetailPage({ schemaId }: { schemaId: string }) {
  const router = useRouter();
  const [xml, setXml] = React.useState<string | null>(null);
  const [schema, setSchema] = React.useState<OlapSchemaViewModel | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadSchema = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const source = await getOlapSchemaXml(schemaId);
      const model = parseMondrianSchema(source);
      setXml(source);
      setSchema(model);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [schemaId]);

  React.useEffect(() => {
    void loadSchema();
  }, [loadSchema]);

  if (loading) {
    return (
      <section
        className="space-y-4"
        aria-busy="true"
        aria-label="Loading schema"
      >
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-[620px] animate-pulse rounded-xl border border-border bg-muted/50" />
      </section>
    );
  }

  if (error || !schema || xml === null) {
    return (
      <section
        className="space-y-4"
        aria-labelledby="schema-detail-error-title"
      >
        <Button variant="outline" onClick={() => router.push('/schemas')}>
          Back to schemas
        </Button>
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <h1 id="schema-detail-error-title" className="font-semibold">
            Could not open schema
          </h1>
          <p className="mt-1 whitespace-pre-wrap">
            {error ?? 'No schema data is available.'}
          </p>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={() => void loadSchema()}
          >
            Try again
          </Button>
        </div>
      </section>
    );
  }

  return (
    <OlapSchemaViewer
      schema={schema}
      xml={xml}
      onBack={() => router.push('/schemas')}
    />
  );
}
