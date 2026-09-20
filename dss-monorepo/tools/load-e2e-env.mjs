import fs from 'node:fs';
import path from 'node:path';

const assignment = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const values = {};
  for (const sourceLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(assignment);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

export function loadAppEnv(appDirectory) {
  const values = { ...process.env };
  const filePath = path.resolve(appDirectory, '.env');
  for (const [key, value] of Object.entries(readEnvFile(filePath))) {
    if (process.env[key] === undefined) values[key] = value;
  }
  const expanded = expand(values);
  Object.assign(process.env, expanded);
  return expanded;
}

function expand(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => {
    let expanded = value;
    for (let pass = 0; pass < 5; pass += 1) {
      const next = expanded.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
        (_match, name) => values[name] ?? process.env[name] ?? '');
      if (next === expanded) break;
      expanded = next;
    }
    return [key, expanded];
  }));
}

/** Load app and E2E env files while preserving explicitly exported variables. */
export function loadE2EEnv(e2eDirectory, appDirectory) {
  const files = [
    path.resolve(e2eDirectory, '..', appDirectory, '.env'),
    path.resolve(e2eDirectory, '.env.e2e'),
  ];
  const values = { ...process.env };
  for (const filePath of files) {
    for (const [key, value] of Object.entries(readEnvFile(filePath))) {
      if (process.env[key] === undefined) values[key] = value;
    }
  }
  const expanded = expand(values);
  for (const [key, value] of Object.entries(expanded)) {
    if (key.endsWith('_URL') || key.endsWith('_BASE_URL')) {
      expanded[key] = value.replace(/(https?:\/\/localhost)(\d+)(?=\/|$)/, '$1:$2');
    }
  }
  Object.assign(process.env, expanded);
  return expanded;
}

export function resolveBaseURL(value, port) {
  const fallback = `http://localhost:${port}`;
  if (!value) return fallback;
  try {
    const url = new URL(value);
    if (url.hostname === 'localhost' && url.port !== String(port)) return fallback;
    return url.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}
