import { createHash } from 'node:crypto';
import { appendFile, cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function packageAdmin({
  root = fileURLToPath(new URL('../../../', import.meta.url)),
  commit = process.env.GITHUB_SHA ?? null,
  releaseNumber = process.env.GITHUB_RUN_NUMBER ?? null,
} = {}) {
  if (commit !== null && !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid release commit');
  if (releaseNumber !== null && !/^[1-9][0-9]*$/.test(releaseNumber)) throw new Error('Invalid release number');
  const dist = join(root, 'apps/admin/dist');
  const index = await readFile(join(dist, 'index.html'));
  if (!index.length) throw new Error('Missing production build');
  const output = join(root, 'artifacts');
  await mkdir(output, { recursive: true });
  const stage = await mkdtemp(join(output, 'domainexp-admin-package-'));
  await cp(dist, join(stage, 'site'), { recursive: true });
  const deploy = join(root, 'apps/admin/deploy');
  for (const name of ['install.sh', 'frontend.conf', 'admin.domainexprt.com.conf']) {
    await cp(join(deploy, name), join(stage, name));
  }
  await cp(join(deploy, 'Dockerfile.prebuilt'), join(stage, 'Dockerfile'));
  await writeFile(join(stage, '.dockerignore'), '**\n!Dockerfile\n!frontend.conf\n!site/\n!site/**\n');
  await writeFile(join(stage, 'release.json'), JSON.stringify({
    commit, releaseNumber, indexSha256: createHash('sha256').update(index).digest('hex'),
  }) + '\n');
  const archive = join(output, 'domainexp-admin.tar.gz');
  const result = spawnSync('tar', ['-czf', archive, '-C', stage, '.'], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Archive creation failed: ${result.stderr}`);
  const checksum = createHash('sha256').update(await readFile(archive)).digest('hex');
  await writeFile(archive + '.sha256', `${checksum}  domainexp-admin.tar.gz\n`);
  return { archive, stage, checksum };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const result = await packageAdmin();
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `directory=${result.stage}\n`);
  console.log(`Packaged frontend: ${result.archive}\nSHA256: ${result.checksum}`);
}
