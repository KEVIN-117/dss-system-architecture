import type { ApiOperation, ApiSchemaField } from './api-catalog';

export type CodeSample = { id: string; label: string; language: string; code: string };

const placeholderByType: Record<string, unknown> = {
  string: '<texto>',
  integer: 0,
  number: 0,
  boolean: false,
};

/** Template built from the schema (not a real payload): every value is a typed placeholder. */
function template(fields: ApiSchemaField[]): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((field) => {
      const base = field.type.split(' | ')[0];
      if (field.enum?.length) return [field.name, field.enum[0]];
      if (base.startsWith('array')) return [field.name, field.children?.length ? [template(field.children)] : []];
      if (base === 'object') return [field.name, field.children?.length ? template(field.children) : {}];
      return [field.name, placeholderByType[base] ?? `<${base}>`];
    }),
  );
}

export function requestBodyFor(operation: ApiOperation): { body?: string; isTemplate: boolean } {
  if (!operation.requestContentType?.includes('json')) return { isTemplate: false };
  if (operation.requestExample !== undefined) {
    return { body: JSON.stringify(operation.requestExample, null, 2), isTemplate: false };
  }
  if (!operation.requestFields.length) return { body: '{}', isTemplate: true };
  return { body: JSON.stringify(template(operation.requestFields), null, 2), isTemplate: true };
}

export function buildCodeSamples(operation: ApiOperation): { samples: CodeSample[]; isTemplate: boolean } {
  const query = operation.parameters
    .filter((parameter) => parameter.location === 'query' && parameter.required)
    .map((parameter) => `${parameter.name}=<${parameter.name}>`)
    .join('&');
  const url = `$BASE_URL${operation.path}${query ? `?${query}` : ''}`;
  const jsUrl = `\`\${BASE_URL}${operation.path}${query ? `?${query}` : ''}\``;
  const auth = operation.authKinds[0];
  const { body, isTemplate } = requestBodyFor(operation);
  const isMultipart = operation.requestContentType?.includes('multipart');

  const curlLines = [`curl -X ${operation.method} "${url}"`];
  if (auth === 'bearer') curlLines.push(`  -H "Authorization: Bearer $TOKEN"`);
  if (auth === 'cookie') curlLines.push(`  -b "dss_session=$DSS_SESSION"`);
  if (body) {
    curlLines.push(`  -H "Content-Type: application/json"`);
    curlLines.push(`  -d '${body.replace(/'/g, "'\\''")}'`);
  }
  if (isMultipart) {
    for (const field of operation.requestFields) {
      curlLines.push(field.type === 'string' && field.name === 'file' ? `  -F "file=@archivo.xml"` : `  -F "${field.name}=<${field.name}>"`);
    }
  }

  const headers: string[] = [];
  if (auth === 'bearer') headers.push('Authorization: `Bearer ${token}`');
  if (body) headers.push("'Content-Type': 'application/json'");
  const jsOptions = [
    `  method: '${operation.method}',`,
    headers.length ? `  headers: { ${headers.join(', ')} },` : '',
    auth === 'cookie' ? "  credentials: 'include', // envía la cookie de sesión del BFF" : '',
    body ? `  body: JSON.stringify(${body.split('\n').join('\n  ')}),` : '',
    isMultipart ? '  body: formData, // FormData con los campos del contrato' : '',
  ].filter(Boolean);

  const pythonLines = ['import requests', '', `response = requests.${operation.method.toLowerCase()}(`, `    f"{BASE_URL}${operation.path}"${query ? ` + "?${query}"` : ''},`];
  if (auth === 'bearer') pythonLines.push('    headers={"Authorization": f"Bearer {token}"},');
  if (auth === 'cookie') pythonLines.push('    cookies={"dss_session": dss_session},');
  if (body) pythonLines.push(`    json=${body.replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None').split('\n').join('\n    ')},`);
  pythonLines.push('    timeout=30,', ')', 'response.raise_for_status()', 'print(response.json())');

  return {
    isTemplate,
    samples: [
      { id: 'curl', label: 'cURL', language: 'bash', code: curlLines.join(' \\\n') },
      {
        id: 'js',
        label: 'JavaScript',
        language: 'javascript',
        code: `const response = await fetch(${jsUrl}, {\n${jsOptions.join('\n')}\n});\nif (!response.ok) throw new Error(\`HTTP \${response.status}\`);\nconst data = await response.json();`,
      },
      { id: 'python', label: 'Python', language: 'python', code: pythonLines.join('\n') },
    ],
  };
}
