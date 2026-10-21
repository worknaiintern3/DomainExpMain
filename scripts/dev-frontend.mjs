// Start the Vite app and Next.js landing page in one terminal.
import { spawn, spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npmCli = process.env.npm_execpath;
const children = new Map();
let stopping = false;

function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children.keys()) stopChild(child);
}

function start(label, workspace, env = process.env) {
  const args = ['run', 'dev', `--workspace=${workspace}`];
  const child = spawn(npmCli ? process.execPath : isWindows ? 'npm.cmd' : 'npm', npmCli ? [npmCli, ...args] : args, {
    stdio: 'inherit',
    detached: !isWindows,
    windowsHide: true,
    env,
  });
  children.set(child, label);
  child.on('error', (error) => {
    console.error(`[dev:frontend] ${label} failed to start: ${error.message}`);
    stopAll(1);
  });
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (!stopping) {
      console.error(`[dev:frontend] ${label} stopped (${signal ?? `exit ${code}`}); stopping both.`);
      stopAll(code || 1);
    }
  });
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
  process.on(signal, () => stopAll(0));
}

start('Web', '@domainpulse/web', {
  ...process.env,
  VITE_LANDING_URL: process.env.VITE_LANDING_URL ?? 'http://localhost:3001',
});
start('Landing', '@domainpulse/landing', {
  ...process.env,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173',
});
console.log('[dev:frontend] Web: http://localhost:5173 | Landing: http://localhost:3001 | Ctrl+C stops both.');
