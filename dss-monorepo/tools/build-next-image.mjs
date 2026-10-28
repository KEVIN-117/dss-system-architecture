import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const appName = process.argv[2];
const appBuildConfig = {
  bff: [],
  'admin-portal': ['NEXT_PUBLIC_BFF_URL'],
  'director-dashboard': ['NEXT_PUBLIC_BFF_URL'],
  'decano-dashboard': ['NEXT_PUBLIC_BFF_URL'],
  'rector-dashboard': ['NEXT_PUBLIC_BFF_URL'],
  landing: [
    'NEXT_PUBLIC_BFF_URL',
    'NEXT_PUBLIC_ADMIN_PORTAL_URL',
    'NEXT_PUBLIC_RECTOR_DASHBOARD_URL',
    'NEXT_PUBLIC_DECANO_DASHBOARD_URL',
    'NEXT_PUBLIC_DIRECTOR_DASHBOARD_URL',
  ],
  'docs-portal': [],
  'olap-workspace': ['NEXT_PUBLIC_BFF_URL'],
};

if (!Object.hasOwn(appBuildConfig, appName)) {
  console.error(`Usage: node tools/build-next-image.mjs <${Object.keys(appBuildConfig).join('|')}>`);
  process.exit(2);
}

const appEnvFile = path.resolve(`apps/${appName}/.env`);
if (existsSync(appEnvFile) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(appEnvFile);
} else if (existsSync(appEnvFile)) {
  for (const line of readFileSync(appEnvFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || Object.hasOwn(process.env, match[1])) continue;
    const [, key, rawValue] = match;
    const value = rawValue.startsWith('"') && rawValue.endsWith('"')
      ? JSON.parse(rawValue)
      : rawValue.startsWith("'") && rawValue.endsWith("'")
        ? rawValue.slice(1, -1)
        : rawValue.replace(/\s+#.*$/, '');
    process.env[key] = value;
  }
}

const requiredUrls = appBuildConfig[appName];
const invalidUrls = requiredUrls.filter((name) => {
  try {
    const url = new URL(process.env[name] ?? '');
    return !['http:', 'https:'].includes(url.protocol) || !url.host;
  } catch {
    return true;
  }
});

if (invalidUrls.length) {
  console.error(
    `Set valid HTTP(S) URLs for ${invalidUrls.join(', ')} in apps/${appName}/.env or the shell environment before building.`,
  );
  process.exit(1);
}

const buildArgs = ['build', '--file', 'Dockerfile', '--tag', `dss-${appName}`, '--build-arg', `APP_NAME=${appName}`];
for (const name of requiredUrls) {
  buildArgs.push('--build-arg', `${name}=${process.env[name]}`);
}
buildArgs.push('.');

const result = spawnSync('docker', buildArgs, { stdio: 'inherit' });
if (result.error) {
  console.error(`Could not start Docker: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
