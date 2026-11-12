#!/usr/bin/env node
/**
 * Copies the OpenAPI contracts versioned under `<repo>/docs/**` into
 * `apps/docs-portal/openapi/` so the portal can be built and served from the
 * `dss-monorepo` Docker context, where the repository-level `docs/` folder does
 * not exist.
 *
 *   node scripts/sync-openapi.mjs          # refresh the snapshot
 *   node scripts/sync-openapi.mjs --check  # fail when the snapshot is stale
 *
 * When `<repo>/docs` is missing (Docker build), the committed snapshot is used
 * as is.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.resolve(appRoot, '..', '..', '..', 'docs');
const snapshotRoot = path.join(appRoot, 'openapi');
const check = process.argv.includes('--check');

function listYaml(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (/\.ya?ml$/i.test(entry.name)) files.push(absolute);
    }
  };
  if (existsSync(root)) visit(root);
  return files;
}

function isOpenApi(source) {
  return /^openapi:\s*['"]?3\./m.test(source) && /^paths:/m.test(source);
}

const relative = (root, file) => path.relative(root, file).split(path.sep).join('/');

if (!existsSync(docsRoot)) {
  console.log(`[sync-openapi] ${docsRoot} no existe; se usa la copia versionada en openapi/.`);
  process.exit(0);
}

const expected = new Map();
for (const file of listYaml(docsRoot)) {
  const source = readFileSync(file, 'utf8');
  if (isOpenApi(source)) expected.set(relative(docsRoot, file), source);
}

const current = new Map(
  listYaml(snapshotRoot).map((file) => [relative(snapshotRoot, file), readFileSync(file, 'utf8')]),
);

const stale = [
  ...[...expected].filter(([name, source]) => current.get(name) !== source).map(([name]) => name),
  ...[...current.keys()].filter((name) => !expected.has(name)),
];

if (check) {
  if (stale.length) {
    console.error(
      `[sync-openapi] La copia de contratos está desactualizada: ${stale.join(', ')}.\n` +
        'Ejecuta `bun nx run @dss-monorepo/docs-portal:sync-openapi` y confirma los cambios.',
    );
    process.exit(1);
  }
  console.log(`[sync-openapi] ${expected.size} contratos sincronizados.`);
  process.exit(0);
}

for (const name of current.keys()) {
  if (!expected.has(name)) rmSync(path.join(snapshotRoot, name));
}
for (const [name, source] of expected) {
  const target = path.join(snapshotRoot, name);
  mkdirSync(path.dirname(target), { recursive: true });
  if (current.get(name) !== source) writeFileSync(target, source);
}
console.log(`[sync-openapi] ${expected.size} contratos copiados en openapi/ (${stale.length} cambiados).`);
