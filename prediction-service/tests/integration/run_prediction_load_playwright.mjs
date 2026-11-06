#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { loadE2EEnv } from '../../../dss-monorepo/tools/load-e2e-env.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../../..');
const monorepoRoot = path.join(repositoryRoot, 'dss-monorepo');
const require = createRequire(path.join(monorepoRoot, 'package.json'));
const { chromium } = require('playwright');

const { values } = parseArgs({
  options: {
    help: { type: 'boolean', short: 'h', default: false },
    'program-ref': { type: 'string', default: 'ADM' },
    'cut-id': { type: 'string', default: '79' },
    'subject-ref': { type: 'string', default: '6377' },
    'duration-seconds': { type: 'string', default: '10' },
    clients: { type: 'string', default: '2' },
    'inject-worker-crash': { type: 'boolean', default: false },
    enforce: { type: 'boolean', default: false },
    'max-p95-regression': { type: 'string' },
    'max-error-rate': { type: 'string' },
    output: { type: 'string' },
  },
});

if (values.help) {
  console.log(`Usage: bun run prediction:load:e2e -- [options]

Options:
  --program-ref <ref>          Faker program (default: ADM)
  --cut-id <id>                Processed Faker cut (default: 79)
  --subject-ref <ref>          Eligible subject_ref (default: 6377)
  --duration-seconds <number>  Window duration (default: 10)
  --clients <number>           Concurrent clients (default: 2)
  --inject-worker-crash        Exercise isolated worker restart
  --enforce                    Require agreed performance thresholds
  --max-p95-regression <ratio> Required with --enforce
  --max-error-rate <ratio>     Required with --enforce, from 0 to 1
  --output <path>              Report path relative to repository root
  -h, --help                   Show this message`);
  process.exit(0);
}

const integerOption = (name, raw, minimum) => {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`--${name} must be an integer greater than or equal to ${minimum}.`);
  }
  return String(value);
};

const programRef = values['program-ref'].trim();
const cutId = values['cut-id'].trim();
const subjectRef = values['subject-ref'].trim();
const durationSeconds = integerOption('duration-seconds', values['duration-seconds'], 1);
const clients = integerOption('clients', values.clients, 1);
if (!programRef || !cutId || !subjectRef) {
  throw new Error('--program-ref, --cut-id, and --subject-ref cannot be empty.');
}
if (values.enforce && (!values['max-p95-regression'] || !values['max-error-rate'])) {
  throw new Error('--enforce requires --max-p95-regression and --max-error-rate.');
}
const parsePositiveNumber = (name, raw, maximum = Number.POSITIVE_INFINITY) => {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    throw new Error(`--${name} must be a number between 0 and ${maximum}.`);
  }
  return String(value);
};
const maxP95Regression = values['max-p95-regression'] === undefined
  ? undefined : parsePositiveNumber('max-p95-regression', values['max-p95-regression']);
const maxErrorRate = values['max-error-rate'] === undefined
  ? undefined : parsePositiveNumber('max-error-rate', values['max-error-rate'], 1);

const e2eDirectory = path.join(monorepoRoot, 'apps', 'admin-portal-e2e');
const env = loadE2EEnv(e2eDirectory, 'admin-portal');
const rectorEnv = loadE2EEnv(path.join(monorepoRoot, 'apps', 'rector-dashboard-e2e'), 'rector-dashboard');
const username = env.PREDICTION_LOAD_SUPERADMIN_USERNAME?.trim();
const password = env.PREDICTION_LOAD_SUPERADMIN_PASSWORD;
if (!username || !password) {
  throw new Error(
    'Set PREDICTION_LOAD_SUPERADMIN_USERNAME and PREDICTION_LOAD_SUPERADMIN_PASSWORD in dss-monorepo/apps/admin-portal-e2e/.env.e2e.',
  );
}
const rectorUsername = rectorEnv.PREDICTION_E2E_RECTOR_USERNAME?.trim();
const rectorPassword = rectorEnv.PREDICTION_E2E_RECTOR_PASSWORD;
if (!rectorUsername || !rectorPassword) {
  throw new Error(
    'Set PREDICTION_E2E_RECTOR_USERNAME and PREDICTION_E2E_RECTOR_PASSWORD in dss-monorepo/apps/rector-dashboard-e2e/.env.e2e.',
  );
}

const bffUrl = (env.PREDICTION_LOAD_BFF_URL || env.NEXT_PUBLIC_BFF_URL || 'http://localhost:3006').replace(/\/$/, '');
const dashboardUrl = (env.PREDICTION_LOAD_DASHBOARD_URL || 'http://localhost:3004').replace(/\/$/, '');
const adminPortalUrl = (env.ADMIN_PORTAL_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const assertLocalUrl = (value, name) => {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname)) {
    throw new Error(`${name} must use a local http:// URL for this development-only test.`);
  }
  return url;
};
const bff = assertLocalUrl(bffUrl, 'PREDICTION_LOAD_BFF_URL');
const dashboard = assertLocalUrl(dashboardUrl, 'PREDICTION_LOAD_DASHBOARD_URL');
const adminPortal = assertLocalUrl(adminPortalUrl, 'ADMIN_PORTAL_BASE_URL');

const contextOptions = { viewport: { width: 1440, height: 1000 } };
let browser;
let child;

async function signIn(context, portal, returnTo, account, expectedRole) {
  const page = await context.newPage();
  const portalLogin = new URL(`/login?returnTo=${encodeURIComponent(returnTo)}`, portal);
  await page.goto(portalLogin.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.locator('#username').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#username').fill(account.username);
  await page.locator('#password').fill(account.password);
  await page.locator('#kc-login').click();

  const loginOutcome = await Promise.race([
    page.waitForURL((url) => url.origin === portal.origin &&
      (url.pathname === returnTo || url.searchParams.get('error') === 'authentication_failed'), {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    }).then(() => 'callback'),
    page.getByRole('heading', { name: /update password/i })
      .waitFor({ state: 'visible', timeout: 45_000 })
      .then(() => 'password_update_required'),
  ]);
  if (loginOutcome === 'password_update_required') {
    throw new Error(`The E2E ${expectedRole} account requires a password update; configure a permanent dev password first.`);
  }
  if (new URL(page.url()).searchParams.get('error') === 'authentication_failed') {
    throw new Error(`Keycloak login for ${expectedRole} failed. Check local BFF and Auth Service logs.`);
  }

  const profileResponse = await context.request.get(new URL('/api/auth/me', bff).toString(), { timeout: 15_000 });
  if (!profileResponse.ok()) throw new Error(`The ${expectedRole} BFF session check failed with HTTP ${profileResponse.status()}.`);
  const profile = await profileResponse.json();
  if (!Array.isArray(profile.roles) || !profile.roles.includes(expectedRole)) {
    throw new Error(`The configured local E2E account lacks the ${expectedRole} role.`);
  }
  const session = (await context.cookies(bff.toString())).find((cookie) => cookie.name === 'dss_session');
  if (!session?.value) throw new Error(`Keycloak login did not establish the ${expectedRole} BFF session.`);
  return `dss_session=${session.value}`;
}

try {
  browser = await chromium.launch({ headless: true });
  const adminContext = await browser.newContext(contextOptions);
  const rectorContext = await browser.newContext(contextOptions);
  console.log('Signing in separately as SUPERADMIN (training) and RECTOR (academic prediction scope)…');
  const trainingSession = await signIn(adminContext, adminPortal, '/ml-operations', { username, password }, 'SUPERADMIN');
  const academicSession = await signIn(rectorContext, dashboard, '/predictions',
    { username: rectorUsername, password: rectorPassword }, 'RECTOR');

  const args = [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(scriptDirectory, 'run_prediction_load_isolated.ps1'),
    '-ConfirmDevelopment', '-ProgramRef', programRef, '-CutId', cutId,
    '-SubjectRef', subjectRef, '-DurationSeconds', durationSeconds, '-Clients', clients,
  ];
  if (values['inject-worker-crash']) args.push('-InjectWorkerCrash');
  if (values.enforce) {
    args.push('-Enforce', '-MaxP95Regression', maxP95Regression, '-MaxErrorRate', maxErrorRate);
  }
  if (values.output) args.push('-Output', values.output);

  const childEnvironment = { ...process.env };
  delete childEnvironment.PREDICTION_LOAD_ACCESS_TOKEN;
  delete childEnvironment.PREDICTION_LOAD_SUPERADMIN_USERNAME;
  delete childEnvironment.PREDICTION_LOAD_SUPERADMIN_PASSWORD;
  childEnvironment.PREDICTION_LOAD_SESSION_COOKIE = academicSession;
  childEnvironment.PREDICTION_LOAD_TRAINING_SESSION_COOKIE = trainingSession;
  childEnvironment.PREDICTION_LOAD_BFF_URL = bff.toString().replace(/\/$/, '');
  childEnvironment.PREDICTION_LOAD_DASHBOARD_URL = dashboard.toString().replace(/\/$/, '');
  childEnvironment.PREDICTION_LOAD_PROGRAM_REF = programRef;
  childEnvironment.PREDICTION_LOAD_CUT_ID = cutId;
  childEnvironment.PREDICTION_LOAD_SUBJECT_REF = subjectRef;
  childEnvironment.PREDICTION_ENV = 'development';

  console.log('RECTOR and SUPERADMIN sessions are valid. Starting the isolated load characterization…');
  child = spawn('powershell.exe', args, {
    cwd: repositoryRoot,
    env: childEnvironment,
    stdio: 'inherit',
    windowsHide: true,
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
  process.exitCode = exitCode;
} finally {
  if (child && child.exitCode === null) child.kill();
  await browser?.close();
}
