'use client';

import { PREDICTION_OBJECTIVES, type PredictionEventType } from './objectives';

/** Picks the prediction objective (deserción, rezago, PPA) whose publications the page reads. */
export function ObjectiveSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: PredictionEventType;
  onChange: (eventType: PredictionEventType) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Objetivo de predicción" className="flex flex-wrap gap-2">
      {PREDICTION_OBJECTIVES.map((objective) => {
        const selected = objective.eventType === value;
        return (
          <button
            key={objective.eventType}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            title={objective.description}
            onClick={() => onChange(objective.eventType)}
            className={
              selected
                ? 'rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm font-semibold text-foreground'
                : 'rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50'
            }
          >
            {objective.label}
          </button>
        );
      })}
    </div>
  );
}
