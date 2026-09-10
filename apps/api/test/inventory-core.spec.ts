import { randomUUID } from 'node:crypto';

import {
  CreateDomainRequestSchema,
  CreateEmailAccountRequestSchema,
  CreateProjectRequestSchema,
  InventoryListQuerySchema,
} from '@domainpulse/contracts';
import { describe, expect, it, vi } from 'vitest';

import { InventoryWriteForbiddenError } from '../src/inventory/inventory.errors';
import { InventoryService } from '../src/inventory/inventory.service';
import type { InventoryStore } from '../src/inventory/inventory.types';
import {
  normalizeDomainName,
  normalizeInventoryEmail,
  normalizeProjectName,
} from '../src/inventory/normalization/inventory-normalization';
import {
  decodeInventoryCursor,
  encodeInventoryCursor,
} from '../src/inventory/pagination/inventory-pagination';
import type { WorkspacePrincipal } from '../src/workspace-context';

function principal(
  role: WorkspacePrincipal['role'],
): WorkspacePrincipal {
  return {
    membershipId: randomUUID(),
    role,
    sessionId: randomUUID(),
    userId: randomUUID(),
    workspaceId: randomUUID(),
  };
}

function storeMock() {
  const archive = vi.fn<InventoryStore['archive']>(() => Promise.resolve(true));
  const create = vi.fn<InventoryStore['create']>();
  const findById = vi.fn<InventoryStore['findById']>();
  const list = vi.fn<InventoryStore['list']>(() =>
      Promise.resolve({ items: [], nextCursor: null }),
    );
  const update = vi.fn<InventoryStore['update']>();
  const store: InventoryStore = {
    archive,
    create,
    findById,
    list,
    update,
  };
  return { archive, create, findById, list, store, update };
}

describe('inventory normalization', () => {
  it('normalizes email and project names in the application layer', () => {
    expect(normalizeInventoryEmail('  Person@Example.Test ')).toEqual({
      email: 'Person@Example.Test',
      normalizedEmail: 'person@example.test',
    });
    expect(normalizeProjectName('  Launch Site ')).toEqual({
      name: 'Launch Site',
      normalizedName: 'launch site',
    });
  });

  it('normalizes ASCII, Unicode IDNA, and a terminal DNS root dot', () => {
    expect(normalizeDomainName(' Example.COM. ')).toEqual({
      domainName: 'Example.COM',
      normalizedDomainName: 'example.com',
    });
    expect(normalizeDomainName('b\u00fccher.example')).toEqual({
      domainName: 'b\u00fccher.example',
      normalizedDomainName: 'xn--bcher-kva.example',
    });
  });

  it.each([
    '',
    '*.example.test',
    'bad label.example',
    'bad..example',
    `${'a'.repeat(64)}.example`,
    `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}`,
  ])('rejects invalid canonical domain input', (input) => {
    expect(() => normalizeDomainName(input)).toThrow('Invalid inventory input');
  });
});

describe('inventory contracts and pagination', () => {
  it('rejects server-owned and internal fields from strict create contracts', () => {
    expect(
      CreateEmailAccountRequestSchema.safeParse({
        email: 'person@example.test',
        normalizedEmail: 'person@example.test',
      }).success,
    ).toBe(false);
    expect(
      CreateProjectRequestSchema.safeParse({
        inventoryState: 'TRACKED',
        name: 'Project',
      }).success,
    ).toBe(false);
    expect(
      CreateDomainRequestSchema.safeParse({
        domainName: 'example.test',
        nodeId: randomUUID(),
        provenance: 'USER_ADDED',
        workspaceId: randomUUID(),
      }).success,
    ).toBe(false);
  });

  it('applies bounded list defaults and rejects an excessive limit', () => {
    expect(InventoryListQuerySchema.parse({})).toEqual({
      includeArchived: false,
      limit: 50,
    });
    expect(InventoryListQuerySchema.parse({ includeArchived: 'true' })).toEqual({
      includeArchived: true,
      limit: 50,
    });
    expect(InventoryListQuerySchema.safeParse({ limit: '101' }).success).toBe(
      false,
    );
  });

  it('round-trips an opaque precision-preserving keyset cursor', () => {
    const position = {
      createdAt: '2034-04-05T06:07:08.123456Z',
      id: randomUUID(),
    };
    const cursor = encodeInventoryCursor(position);

    expect(cursor).not.toContain(position.id);
    expect(decodeInventoryCursor(cursor)).toEqual(position);
    expect(() => decodeInventoryCursor('not-a-valid-cursor')).toThrow(
      'Invalid inventory cursor',
    );
  });
});

describe('InventoryService authorization and normalization', () => {
  it('allows member reads while denying every write operation', async () => {
    const { archive, create, list, store, update } = storeMock();
    const service = new InventoryService(store);
    const member = principal('member');

    await expect(
      service.list(member, 'project', {
        includeArchived: false,
        limit: 50,
      }),
    ).resolves.toEqual({ items: [], nextCursor: null });
    await expect(
      service.create(member, {
        resource: 'project',
        input: { name: 'Denied' },
      }),
    ).rejects.toBeInstanceOf(InventoryWriteForbiddenError);
    await expect(
      service.update(member, randomUUID(), {
        resource: 'project',
        input: { name: 'Denied' },
      }),
    ).rejects.toBeInstanceOf(InventoryWriteForbiddenError);
    await expect(
      service.archive(member, 'project', randomUUID()),
    ).rejects.toBeInstanceOf(InventoryWriteForbiddenError);
    expect(list).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(archive).not.toHaveBeenCalled();
  });

  it.each(['owner', 'admin'] as const)(
    'allows %s writes and supplies normalized server-owned persistence input',
    async (role) => {
      const { create, store, update } = storeMock();
      const workspacePrincipal = principal(role);
      const now = new Date('2035-01-02T03:04:05.000Z');
      const service = new InventoryService(store, () => now);
      const recordId = randomUUID();
      create.mockRejectedValue(new Error('test stop'));
      update.mockRejectedValue(new Error('test stop'));

      await service
        .create(workspacePrincipal, {
          resource: 'domain',
          input: { domainName: ' B\u00dcCHER.Example. ' },
        })
        .catch(() => undefined);
      expect(create).toHaveBeenCalledWith(workspacePrincipal.workspaceId, {
        resource: 'domain',
        values: {
          autoRenew: null,
          dnsProviderAccountId: null,
          domainName: 'B\u00dcCHER.Example',
          expiresAt: null,
          normalizedDomainName: 'xn--bcher-kva.example',
          notes: null,
          registeredAt: null,
          registrarProviderAccountId: null,
        },
      });

      await service
        .update(workspacePrincipal, recordId, {
          resource: 'project',
          input: { inventoryState: 'TRACKED', name: '  New Name ' },
        })
        .catch(() => undefined);
      expect(update).toHaveBeenCalledWith(
        workspacePrincipal.workspaceId,
        recordId,
        {
          resource: 'project',
          values: {
            inventoryState: 'TRACKED',
            name: 'New Name',
            normalizedName: 'new name',
            updatedAt: now,
          },
        },
      );
    },
  );
});
