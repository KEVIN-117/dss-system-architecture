'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { CodeSample } from '../lib/code-samples';

export default function CodeTabs({ samples }: { samples: CodeSample[] }) {
  const [active, setActive] = useState(samples[0]?.id);
  const [copied, setCopied] = useState(false);
  const current = samples.find((sample) => sample.id === active) ?? samples[0];
  if (!current) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="dp-code">
      <div className="dp-code-bar">
        <div role="tablist" aria-label="Lenguaje del ejemplo">
          {samples.map((sample) => (
            <button
              key={sample.id}
              type="button"
              role="tab"
              id={`tab-${sample.id}`}
              aria-selected={sample.id === current.id}
              aria-controls="dp-code-panel"
              onClick={() => setActive(sample.id)}
            >
              {sample.label}
            </button>
          ))}
        </div>
        <button type="button" className="dp-code-copy" onClick={copy} aria-label="Copiar ejemplo">
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre id="dp-code-panel" role="tabpanel" aria-labelledby={`tab-${current.id}`} tabIndex={0}>
        <code>{current.code}</code>
      </pre>
    </div>
  );
}
