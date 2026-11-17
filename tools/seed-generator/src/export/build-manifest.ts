#!/usr/bin/env node
import { DatasetExporter } from './dataset-exporter.js';

const dir = process.argv[2];
if (!dir) {
  console.error('Uso: node dist/export/build-manifest.js <directorio-del-dataset>');
  process.exit(1);
}
console.log(`✓ Manifiesto sellado: ${DatasetExporter.buildManifest(dir)}`);
