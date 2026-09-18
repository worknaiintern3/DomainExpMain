/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, it } from 'vitest';

import {
  isPublicIpAddress,
  resolvePublicAddresses,
  UnsafeNetworkTargetError,
} from '../src/metadata/network/public-network';

describe('metadata public network safety', () => {
  it('accepts representative public IPv4 and IPv6 addresses', () => {
    expect(isPublicIpAddress('93.184.216.34')).toBe(true);
    expect(
      isPublicIpAddress('2606:4700:4700::1111'),
    ).toBe(true);
  });

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.1.1',
    '198.18.0.1',
    '224.0.0.1',
    '::',
    '::1',
    'fc00::1',
    'fd00::1',
    'fe80::1',
    'fec0::1',
    'ff02::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:c0a8:101',
  ])('rejects non-public target %s', (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it('fails closed when DNS mixes public and private targets', async () => {
    await expect(
      resolvePublicAddresses(
        'example.test',
        async () => [
          {
            address: '93.184.216.34',
            family: 4,
          },
          {
            address: '127.0.0.1',
            family: 4,
          },
        ],
      ),
    ).rejects.toBeInstanceOf(UnsafeNetworkTargetError);
  });

  it('treats an empty resolution as resolution failure, not unsafe-address evidence', async () => {
    const error = await resolvePublicAddresses(
      'example.test',
      async () => [],
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(
      UnsafeNetworkTargetError,
    );
  });
});
