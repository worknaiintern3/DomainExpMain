import type { DatabasePingClient } from '../client/database-types';

export type DatabaseAvailability = 'available' | 'unavailable';

export async function checkDatabaseAvailability(
  client: DatabasePingClient,
): Promise<DatabaseAvailability> {
  try {
    await client.ping();
    return 'available';
  } catch {
    return 'unavailable';
  }
}
