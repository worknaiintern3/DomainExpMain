import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  apiRequest,
  configureApiAuthentication,
  setApiCacheSession,
  setExplicitWorkspaceId,
} from './client';

function jsonResponse(body: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': contentType },
    status,
  });
}

afterEach(() => {
  configureApiAuthentication(null);
  setApiCacheSession(null);
  setExplicitWorkspaceId(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('apiRequest', () => {
  it('caches inventory reads per session and clears them after writes and workspace changes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'first' }] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'second' }] }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'third' }] }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'fourth' }] }));
    vi.stubGlobal('fetch', fetchMock);
    configureApiAuthentication({
      getAccessToken: () => 'access-token',
      onAuthenticationFailure: vi.fn(),
      refreshAccessToken: vi.fn(),
    });
    setApiCacheSession('session-1');

    expect(await apiRequest('/domains?limit=50')).toEqual({ items: [{ id: 'first' }] });
    expect(await apiRequest('/domains?limit=50')).toEqual({ items: [{ id: 'first' }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await apiRequest('/domains', { body: { domainName: 'new.example' }, method: 'POST' });
    expect(await apiRequest('/domains?limit=50')).toEqual({ items: [{ id: 'second' }] });
    setExplicitWorkspaceId('workspace-2');
    expect(await apiRequest('/domains?limit=50')).toEqual({ items: [{ id: 'third' }] });
    setApiCacheSession('session-2');
    expect(await apiRequest('/domains?limit=50')).toEqual({ items: [{ id: 'fourth' }] });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('bypasses inventory cache on manual reload and expires entries after 20 seconds', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ items: [1] }))
      .mockResolvedValueOnce(jsonResponse({ items: [2] }))
      .mockResolvedValueOnce(jsonResponse({ items: [3] }));
    vi.stubGlobal('fetch', fetchMock);
    configureApiAuthentication({
      getAccessToken: () => 'access-token',
      onAuthenticationFailure: vi.fn(),
      refreshAccessToken: vi.fn(),
    });
    setApiCacheSession('session-1');

    await apiRequest('/servers?limit=50');
    expect(await apiRequest('/servers?limit=50', { cache: 'no-store' })).toEqual({ items: [2] });
    expect(await apiRequest('/servers?limit=50')).toEqual({ items: [2] });
    now.mockReturnValue(21_001);
    expect(await apiRequest('/servers?limit=50')).toEqual({ items: [3] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('uses the configured API prefix and sends auth, workspace, JSON, and AbortSignal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'domain-1' }));
    vi.stubGlobal('fetch', fetchMock);
    configureApiAuthentication({
      getAccessToken: () => 'access-token',
      onAuthenticationFailure: vi.fn(),
      refreshAccessToken: vi.fn(),
    });
    setExplicitWorkspaceId('workspace-1');
    const controller = new AbortController();

    await apiRequest('/domains', {
      body: { domainName: 'example.test' },
      method: 'POST',
      signal: controller.signal,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url.endsWith('/domains')).toBe(true);
    expect(headers.get('Authorization')).toBe('Bearer access-token');
    expect(headers.get('X-Workspace-Id')).toBe('workspace-1');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init.body).toBe('{"domainName":"example.test"}');
    expect(init.signal).toBe(controller.signal);
  });

  it('supports successful 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiRequest<void>('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('exposes only safe Problem Details fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      detail: 'The record is unavailable.',
      internal: 'must-not-surface',
      requestId: 'request-1',
      status: 404,
      title: 'Not Found',
    }, 404, 'application/problem+json')));

    const error = await apiRequest('/domains/missing').catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      detail: 'The record is unavailable.',
      requestId: 'request-1',
      status: 404,
      title: 'Not Found',
    });
    expect(error).not.toHaveProperty('internal');
  });

  it('refreshes and retries an authenticated request exactly once', async () => {
    let token = 'old-token';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ detail: 'Expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ id: 'domain-1' }));
    const refreshAccessToken = vi.fn(async () => {
      token = 'new-token';
      return token;
    });
    vi.stubGlobal('fetch', fetchMock);
    configureApiAuthentication({
      getAccessToken: () => token,
      onAuthenticationFailure: vi.fn(),
      refreshAccessToken,
    });

    await expect(apiRequest('/domains/domain-1')).resolves.toEqual({ id: 'domain-1' });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get('Authorization'))
      .toBe('Bearer new-token');
  });

  it('never invokes refresh for an unauthenticated auth request', async () => {
    const refreshAccessToken = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 401)));
    configureApiAuthentication({
      getAccessToken: () => 'unused-token',
      onAuthenticationFailure: vi.fn(),
      refreshAccessToken,
    });

    await expect(apiRequest('/auth/login', {
      authenticated: false,
      method: 'POST',
    })).rejects.toBeInstanceOf(ApiError);
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });
});
