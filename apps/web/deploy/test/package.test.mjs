import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { packageWeb } from '../package.mjs';

test('packages the tested static build with revision and checksum, excluding server files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'domainexp-web-test-'));
  await mkdir(join(root, 'apps/web/dist/assets'), { recursive: true });
  await mkdir(join(root, 'apps/api'), { recursive: true });
  await writeFile(join(root, 'apps/web/dist/index.html'), '<html>release</html>');
  await writeFile(join(root, 'apps/web/dist/assets/app.js'), 'console.log("release")');
  await writeFile(join(root, 'apps/api/.env'), 'SECRET=must-not-ship');
  await writeFile(join(root, '.env'), 'SECRET=must-not-ship');
  await cp(new URL('../', import.meta.url), join(root, 'apps/web/deploy'), { recursive: true });
  const commit = 'a'.repeat(40);
  const { archive, stage, checksum } = await packageWeb({ root, commit, releaseNumber: '12' });
  const metadata = JSON.parse(await readFile(join(stage, 'release.json'), 'utf8'));
  assert.equal(metadata.commit, commit);
  assert.equal(metadata.releaseNumber, '12');
  assert.equal(metadata.indexSha256, createHash('sha256').update('<html>release</html>').digest('hex'));
  assert.equal(createHash('sha256').update(await readFile(archive)).digest('hex'), checksum);
  const listing = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });
  assert.equal(listing.status, 0);
  assert.match(listing.stdout, /site\/assets\/app.js/);
  assert.doesNotMatch(listing.stdout, /\.env|apps\/api/);
  assert.deepEqual((await readdir(stage)).sort(), ['.dockerignore', 'Dockerfile', 'domainexprt.com.conf', 'frontend.conf', 'install.sh', 'release.json', 'site']);
});

test('rejects malformed revision metadata before packaging', async () => {
  await assert.rejects(packageWeb({ commit: 'main; echo bad' }), /Invalid release commit/);
  await assert.rejects(packageWeb({ commit: null, releaseNumber: '-1' }), /Invalid release number/);
});
