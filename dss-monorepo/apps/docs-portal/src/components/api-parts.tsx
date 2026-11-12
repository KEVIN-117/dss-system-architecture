import InlineMd from './inline-md';
import type { ApiParameter, ApiSchemaField } from '../lib/api-catalog';

const typeLabels: Record<string, string> = {
  string: 'texto',
  integer: 'entero',
  number: 'número',
  boolean: 'booleano',
  object: 'objeto',
  null: 'nulo',
};

export function typeLabel(type: string): string {
  return type.replace(/\b(string|integer|number|boolean|object|null)\b/g, (match) => typeLabels[match] ?? match);
}

export function MethodBadge({ method, large = false }: { method: string; large?: boolean }) {
  return <span className={`dp-method dp-method-${method.toLowerCase()} ${large ? 'dp-method-lg' : ''}`}>{method}</span>;
}

export function ParameterTable({ parameters }: { parameters: ApiParameter[] }) {
  return (
    <div className="dp-table-wrap">
      <table className="dp-params">
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Ubicación</th>
            <th scope="col">Tipo</th>
            <th scope="col">Descripción</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((parameter) => (
            <tr key={`${parameter.location}-${parameter.name}`}>
              <td>
                <code>{parameter.name}</code>
                {parameter.required && <span className="dp-required">requerido</span>}
              </td>
              <td>{parameter.location}</td>
              <td>{typeLabel(parameter.schemaType ?? 'string')}</td>
              <td>
                <InlineMd text={parameter.description} />
                {parameter.enum?.length ? <span className="dp-hint">Valores: {parameter.enum.join(', ')}</span> : null}
                {parameter.defaultValue !== undefined ? <span className="dp-hint">Predeterminado: {String(parameter.defaultValue)}</span> : null}
                {parameter.minimum !== undefined || parameter.maximum !== undefined ? (
                  <span className="dp-hint">
                    Rango: {parameter.minimum ?? '−∞'} – {parameter.maximum ?? '∞'}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SchemaTree({ fields, level = 0 }: { fields: ApiSchemaField[]; level?: number }) {
  if (!fields.length) return <p className="dp-muted">El contrato no declara propiedades para este esquema.</p>;
  return (
    <ul className={`dp-schema ${level ? 'dp-schema-nested' : ''}`}>
      {fields.map((field) => (
        <li key={`${level}-${field.name}`}>
          <div className="dp-schema-row">
            <code>{field.name}</code>
            <span className="dp-schema-type">{typeLabel(field.type)}</span>
            {field.required && <span className="dp-required">requerido</span>}
          </div>
          {field.description && <p><InlineMd text={field.description} /></p>}
          {field.enum?.length ? <span className="dp-hint">Valores: {field.enum.join(', ')}</span> : null}
          {field.children?.length ? <SchemaTree fields={field.children} level={level + 1} /> : null}
        </li>
      ))}
    </ul>
  );
}
