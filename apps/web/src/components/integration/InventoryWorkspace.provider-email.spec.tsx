// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { listInventory, updateInventory } from '@/api/inventory';
import type { EmailAccount, ProviderAccount } from '@/api/types';
import { providerConfiguration } from '@/features/integration/resource-configs';
import { ResourceFormModal } from './InventoryWorkspace';

vi.mock('@/api/inventory', () => ({
  archiveInventory: vi.fn(),
  createInventory: vi.fn(),
  listInventory: vi.fn(),
  updateInventory: vi.fn(),
}));

vi.mock('@/preferences/PreferencesContext', () => ({
  usePreferences: () => ({ portfolio: { defaultAutoRenew: 'unknown' } }),
}));

const providerId = '00000000-0000-4000-8000-000000000001';
const emailId = '00000000-0000-4000-8000-000000000002';
const provider: ProviderAccount = {
  createdAt: '2026-01-01T00:00:00.000Z',
  externalAccountId: null,
  id: providerId,
  inventoryState: 'TRACKED',
  label: 'Cloudflare',
  loginEmailAccountId: null,
  notes: null,
  provenance: 'USER_ADDED',
  providerKey: 'cloudflare',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const email: EmailAccount = {
  createdAt: '2026-01-01T00:00:00.000Z',
  email: 'mapping-test@example.invalid',
  id: emailId,
  inventoryState: 'TRACKED',
  label: 'Mapping test',
  notes: null,
  provenance: 'USER_ADDED',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function openProvider(record: ProviderAccount = provider) {
  render(<ResourceFormModal config={providerConfiguration} record={record} onClose={vi.fn()} onSaved={vi.fn()} />);
  return screen.getByRole('combobox', { name: /Login email account/i }) as HTMLSelectElement;
}

beforeEach(() => {
  vi.mocked(listInventory).mockResolvedValue({ items: [email], nextCursor: null });
  vi.mocked(updateInventory).mockResolvedValue({ ...provider, loginEmailAccountId: emailId });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('provider login email mapping', () => {
  it('renders a selector with email labels and UUID option values', async () => {
    const select = openProvider();
    expect(select.tagName).toBe('SELECT');
    expect(await screen.findByRole('option', { name: 'Mapping test — mapping-test@example.invalid' })).toHaveProperty('value', emailId);
    expect(listInventory).toHaveBeenCalledWith('email-accounts', expect.objectContaining({ includeArchived: true, limit: 100 }));
  });

  it('submits the selected email account UUID without exposing a stored credential', async () => {
    const select = openProvider({ ...provider, externalAccountId: 'private-token-value' });
    await screen.findByRole('option', { name: 'Mapping test — mapping-test@example.invalid' });
    fireEvent.change(select, { target: { value: emailId } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Account label' }), { target: { value: 'Cloudflare test' } });
    expect(screen.queryByRole('textbox', { name: /External account ID/i })).toBeNull();
    expect(document.body.textContent).not.toContain('private-token-value');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateInventory).toHaveBeenCalledWith('provider-accounts', providerId, {
      label: 'Cloudflare test',
      loginEmailAccountId: emailId,
    }));
    expect(JSON.stringify(vi.mocked(updateInventory).mock.calls[0]?.[2])).not.toContain(email.email);
  });

  it('sends null when the selected email account is cleared', async () => {
    const select = openProvider({ ...provider, loginEmailAccountId: emailId });
    await screen.findByRole('option', { name: 'Mapping test — mapping-test@example.invalid' });
    fireEvent.change(select, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateInventory).toHaveBeenCalledWith('provider-accounts', providerId, { loginEmailAccountId: null }));
  });

  it('omits an unchanged email mapping when another provider field changes', async () => {
    openProvider({ ...provider, loginEmailAccountId: emailId });
    await screen.findByRole('option', { name: 'Mapping test — mapping-test@example.invalid' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Provider key' }), { target: { value: 'cloudflare-test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateInventory).toHaveBeenCalledWith('provider-accounts', providerId, { providerKey: 'cloudflare-test' }));
  });

  it('shows an empty state when there are no email accounts', async () => {
    vi.mocked(listInventory).mockResolvedValue({ items: [], nextCursor: null });
    const select = openProvider();
    expect(await screen.findByRole('option', { name: 'No email accounts available' })).toHaveProperty('value', '');
    expect(select.value).toBe('');
    expect(select.disabled).toBe(false);
  });

  it('loads later pages so every workspace email account can be selected', async () => {
    vi.mocked(listInventory)
      .mockResolvedValueOnce({ items: [], nextCursor: 'page-two' })
      .mockResolvedValueOnce({ items: [email], nextCursor: null });
    openProvider();
    expect(await screen.findByRole('option', { name: 'Mapping test — mapping-test@example.invalid' })).toHaveProperty('value', emailId);
    expect(listInventory).toHaveBeenNthCalledWith(2, 'email-accounts', expect.objectContaining({ cursor: 'page-two', includeArchived: true }));
  });
});
