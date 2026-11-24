'use client';

import * as React from 'react';
import { Loader } from '@dss-monorepo/design-system';
import { AlertTriangle } from 'lucide-react';

import {
  getDatasetProfile,
  getDatasetSample,
  type DatasetProfile,
  type DatasetSample,
  type FeatureProfile,
} from '../../../data-access/ml-studio';
import { classLabel, decimal, percent } from '../model-charts';
import { CorrelationChart, CountBarChart, HistogramChart } from '../studio-charts';
import { ErrorAlert, Kpi, Notice, Panel, errorMessage } from '../studio-ui';

const numberFormat = new Intl.NumberFormat('es-BO');

const WARNING_TITLES: Record<string, string> = {
  POSSIBLE_LEAKAGE: 'Posible fuga del objetivo',
  HIGH_MISSING: 'Muchos faltantes',
  CONSTANT_FEATURE: 'Variable constante',
  FEW_ROWS: 'Pocas filas',
  SINGLE_PERIOD: 'Un solo periodo',
  SINGLE_CLASS: 'Una sola clase',
  CLASS_IMBALANCE: 'Clases desbalanceadas',
};

/** Step 3: exploratory profile (aggregates only) and a pseudonymised sample of the dataset. */
export function ExploreStep({ datasetRef }: { datasetRef: string }) {
  const [profile, setProfile] = React.useState<DatasetProfile | null>(null);
  const [sample, setSample] = React.useState<DatasetSample | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [focused, setFocused] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setSample(null);
    setError(null);
    Promise.all([getDatasetProfile(datasetRef), getDatasetSample(datasetRef, 20)])
      .then(([nextProfile, nextSample]) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setSample(nextSample);
        setFocused(nextProfile.target_correlations[0]?.field ?? nextProfile.features[0]?.name ?? null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause, 'No se pudo leer el perfil del dataset.'));
      });
    return () => {
      cancelled = true;
    };
  }, [datasetRef]);

  if (error) return <ErrorAlert message={error} />;
  if (!profile) return <Loader text="Leyendo el perfil del dataset…" fullScreen={false} className="py-16" />;

  const target = profile.target;
  const focusedFeature = profile.features.find((feature) => feature.name === focused) ?? null;
  const periods = profile.coverage.rows_by_period ?? [];
  const programs = profile.coverage.rows_by_program ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Filas" value={numberFormat.format(profile.row_count)} hint={`${periods.length} periodos · ${programs.length} carreras`} />
        <Kpi label="Variables" value={profile.feature_count} />
        {target.kind === 'classification' ? (
          <Kpi
            label="Balance de clases"
            value={decimal(target.imbalance_ratio, 2)}
            hint={target.smote_recommended ? 'Se aplicará SMOTE en entrenamiento' : 'Minoritaria ÷ mayoritaria'}
          />
        ) : (
          <Kpi
            label="Objetivo (media)"
            value={decimal(target.summary.mean, 2)}
            hint={`Desv. ${decimal(target.summary.std, 2)} · rango ${decimal(target.summary.min, 1)}–${decimal(target.summary.max, 1)}`}
          />
        )}
        <Kpi label="Avisos" value={profile.warnings.length} hint={profile.warnings.length ? 'Revísalos antes de entrenar' : 'Sin observaciones'} />
      </div>

      {profile.warnings.length > 0 && (
        <section aria-labelledby="warnings-title" className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
          <h2 id="warnings-title" className="flex items-center gap-2 font-semibold">
            <AlertTriangle aria-hidden="true" className="size-4 text-amber-600" /> Avisos del perfil
          </h2>
          <ul className="space-y-1 text-sm">
            {profile.warnings.map((warning, index) => (
              <li key={`${warning.code}-${warning.field ?? index}`}>
                <span className="font-medium">{WARNING_TITLES[warning.code] ?? warning.code}</span>
                {warning.field && <span className="font-mono text-xs"> · {warning.field}</span>}: {warning.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Distribución del objetivo" description={target.field ? `Campo ${target.field}` : undefined}>
          {target.kind === 'classification' ? (
            <CountBarChart
              ariaLabel="Filas por clase del objetivo"
              items={target.classes.map((item) => ({ key: classLabel(item.class_name), count: item.count }))}
            />
          ) : (
            <HistogramChart summary={target.summary} ariaLabel="Histograma del objetivo" />
          )}
        </Panel>
        <Panel title="Filas por periodo" description="La partición temporal entrena con los periodos antiguos y prueba con los más recientes.">
          <CountBarChart ariaLabel="Filas por periodo académico" items={periods} />
        </Panel>
        <Panel title="Correlación con el objetivo" description="Correlación de Pearson; un valor cercano a ±1 puede indicar fuga.">
          <CorrelationChart correlations={profile.target_correlations} />
        </Panel>
        <Panel
          title={focusedFeature ? `Variable: ${focusedFeature.name}` : 'Variable'}
          description="Elige una variable en la tabla para ver su histograma."
        >
          {focusedFeature?.summary ? (
            <HistogramChart summary={focusedFeature.summary} ariaLabel={`Histograma de ${focusedFeature.name}`} />
          ) : focusedFeature?.top_values ? (
            <CountBarChart
              ariaLabel={`Valores más frecuentes de ${focusedFeature.name}`}
              items={focusedFeature.top_values.map((item) => ({ key: item.value, count: item.count }))}
              horizontal
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sin distribución para esta variable.</p>
          )}
        </Panel>
      </div>

      <FeatureTable features={profile.features} focused={focused} onFocus={setFocused} />

      {sample && <SampleTable sample={sample} />}
    </div>
  );
}

function FeatureTable({
  features,
  focused,
  onFocus,
}: {
  features: FeatureProfile[];
  focused: string | null;
  onFocus: (name: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card" aria-labelledby="features-title">
      <h2 id="features-title" className="border-b border-border p-5 font-semibold">Variables</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Variable</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Faltantes</th>
              <th className="px-4 py-3 text-right">Media</th>
              <th className="px-4 py-3 text-right">Desv.</th>
              <th className="px-4 py-3 text-right">Mín – Máx</th>
              <th className="px-4 py-3 text-right">Correlación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {features.map((feature) => (
              <tr
                key={feature.name}
                onClick={() => onFocus(feature.name)}
                aria-selected={feature.name === focused}
                className={`cursor-pointer hover:bg-muted/40 ${feature.name === focused ? 'bg-primary/5' : ''}`}
              >
                <td className="px-4 py-2.5 font-mono text-xs">
                  <button type="button" className="text-left hover:underline" onClick={() => onFocus(feature.name)}>
                    {feature.name}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{feature.logical_type}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{percent(feature.missing_ratio)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{decimal(feature.summary?.mean, 2)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{decimal(feature.summary?.std, 2)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {feature.summary ? `${decimal(feature.summary.min, 1)} – ${decimal(feature.summary.max, 1)}` : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{decimal(feature.target_correlation, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SampleTable({ sample }: { sample: DatasetSample }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card" aria-labelledby="sample-title">
      <div className="border-b border-border p-5">
        <h2 id="sample-title" className="font-semibold">Muestra de filas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {sample.rows.length} de {numberFormat.format(sample.row_count)} filas. Los identificadores están seudonimizados.
        </p>
      </div>
      {sample.rows.length === 0 ? (
        <div className="p-5"><Notice>El dataset no tiene filas.</Notice></div>
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-muted text-muted-foreground">
              <tr>
                {sample.columns.map((column) => (
                  <th key={column} className="whitespace-nowrap px-3 py-2 font-mono font-medium">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sample.rows.map((row, index) => (
                <tr key={index}>
                  {sample.columns.map((column) => (
                    <td key={column} className="whitespace-nowrap px-3 py-1.5 tabular-nums">{cell(row[column])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function cell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : decimal(value, 3);
  return String(value);
}
