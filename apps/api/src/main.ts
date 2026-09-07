import { Logger } from '@nestjs/common';

import { createApplication } from './bootstrap';
import { AppConfigService } from './config/config.module';

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
