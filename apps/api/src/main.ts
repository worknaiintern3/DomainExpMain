import * as fs from 'node:fs';
import * as path from 'node:path';

import { Logger } from '@nestjs/common';

import { createApplication } from './bootstrap';
import { AppConfigService } from './config/config.module';

function loadAndApplyEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch {
    // Continue searching
  }
}

for (const envPath of [
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '.env'),
]) {
  loadAndApplyEnvFile(envPath);
}

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  const config = app.get(AppConfigService);

  await app.listen(config.apiPort, config.apiHost);
}

const logger = new Logger('Bootstrap');

void bootstrap().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  logger.error(`API startup failed (${errorName})`);
  process.exitCode = 1;
});
