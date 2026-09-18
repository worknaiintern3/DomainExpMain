import { describe, expect, it } from 'vitest';

import {
  SERVER_KIND_MAX_LENGTH,
  SERVER_KIND_PATTERN_SOURCE,
  validateServerKindInput,
} from './server-kind';
import { serverConfiguration } from './resource-configs';

describe('server kind form validation', () => {
  it.each(['vps', 'virtual-private-server', 'vm.standard_2'])(
    'accepts the backend canonical-key shape: %s',
    (value) => {
      expect(validateServerKindInput(value)).toBeNull();
      expect(new RegExp(`^${SERVER_KIND_PATTERN_SOURCE}$`, 'u').test(value)).toBe(true);
    },
  );

  it.each(['', '   '])('allows blank input to retain nullable clearing semantics', (value) => {
    expect(validateServerKindInput(value)).toBeNull();
  });

  it.each(['VPS', 'virtual private server', 'vps!', 'a'.repeat(SERVER_KIND_MAX_LENGTH + 1)])(
    'blocks invalid input before the request is submitted: %s',
    (value) => {
      expect(validateServerKindInput(value)).not.toBeNull();
    },
  );

  it('wires the validator into the nullable Add/Edit Server field', () => {
    const field = serverConfiguration(new Map()).fields.find(({ key }) => key === 'serverKind');

    expect(field).toMatchObject({ nullable: true, trimOnBlur: true });
    expect(field?.validate?.('vps')).toBeNull();
    expect(field?.validate?.('')).toBeNull();
    expect(field?.validate?.('VPS')).not.toBeNull();
  });
});
