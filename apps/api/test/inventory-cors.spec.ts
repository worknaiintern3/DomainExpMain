import { describe, expect, it } from 'vitest';

import { API_CORS_ALLOWED_HEADERS } from '../src/bootstrap';

describe('inventory workspace CORS configuration', () => {
  it('allows browser clients to select a workspace explicitly', () => {
    expect(API_CORS_ALLOWED_HEADERS).toContain('X-Workspace-Id');
  });
});
