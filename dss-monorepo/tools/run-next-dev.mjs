import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { loadAppEnv } from './load-e2e-env.mjs';

const require = createRequire(import.meta.url);
const [appDirectory, portVariable] = process.argv.slice(2);
if (!appDirectory || !portVariable) throw new Error('Usage: node tools/run-next-dev.mjs <app-directory> <port-variable>');
const env = loadAppEnv(path.join('apps', appDirectory));
const port = Number(env[portVariable]);
if (!Number.isInteger(port) || port < 0) throw new Error(`${portVariable} must be a non-negative number in apps/${appDirectory}/.env`);
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--port', String(port)], {
  cwd: path.resolve('apps', appDirectory), env: { ...process.env, PORT: String(port) }, stdio: 'inherit',
});
child.on('exit', (code, signal) => { if (signal) process.kill(process.pid, signal); process.exit(code ?? 1); });
