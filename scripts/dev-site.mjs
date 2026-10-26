// Run this project's API, app, and landing page together for local development.
import { spawn, spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npmCli = process.env.npm_execpath;
const children = new Set();
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (isWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else {
      try { process.kill(-child.pid, 'SIGTERM'); }
      catch { child.kill('SIGTERM'); }
    }
  }
}

function start(label, script) {
  const args = ['run', script];
  const child = spawn(npmCli ? process.execPath : isWindows ? 'npm.cmd' : 'npm', npmCli ? [npmCli, ...args] : args, {
    stdio: 'inherit',
    detached: !isWindows,
    windowsHide: true,
  });
  children.add(child);
  child.on('error', (error) => {
    console.error(`[dev:site] ${label}: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code) => {
    children.delete(child);
    if (!stopping) {
      console.error(`[dev:site] ${label} stopped (exit ${code}); stopping the site.`);
      stop(code || 1);
    }
  });
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(signal, () => stop(0));

start('API', 'dev:api');
start('Frontend', 'dev:frontend');
console.log('[dev:site] Landing: http://localhost:3001 | App: http://localhost:5173 | API: http://localhost:4000');
