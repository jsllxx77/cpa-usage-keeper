// @vitest-environment happy-dom

import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CREDENTIAL_LIST_PREFERENCES_STORAGE_KEYS } from '../credentialListPreferences'
import { useCredentialPages } from '../useCredentialPages'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let latest: ReturnType<typeof useCredentialPages> | null = null

function Harness() {
  const result = useCredentialPages({ enabledCredentials: true, enabledAiProviders: true })
  useEffect(() => { latest = result }, [result])
  return <div>Credential lists remain mounted</div>
}

const requestFor = (fetchMock: ReturnType<typeof vi.spyOn>, authType: string) => fetchMock.mock.calls
  .map(([url]) => new URL(String(url), 'http://localhost'))
  .filter((url) => url.searchParams.get('auth_type') === authType)
  .at(-1)?.searchParams

describe('credential storage failures', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState(null, '', '/')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({
      identities: [], total_count: 0, page: 1, page_size: 10, total_pages: 0, type_counts: [],
    }))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    latest = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it.each(['getter', 'getItem'] as const)('mounts with defaults when the storage %s throws SecurityError', async (failure) => {
    const fail = () => { throw new DOMException('Storage blocked', 'SecurityError') }
    const getItem = vi.fn(fail)
    if (failure === 'getter') vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(fail)
    else vi.stubGlobal('localStorage', { getItem, setItem: vi.fn() })

    await act(async () => root.render(<Harness />))
    expect(container.textContent).toBe('Credential lists remain mounted')
    if (failure === 'getItem') expect(getItem).toHaveBeenCalled()
    expect(latest).toMatchObject({
      credentialActiveOnly: false, aiProviderActiveOnly: false,
      credentialSort: 'priority', aiProviderSort: 'total_requests',
      credentialPageSize: 10, aiProviderPageSize: 10,
      credentialProviderFilter: 'all', aiProviderProviderFilter: 'all',
    })
    expect(requestFor(fetchMock, '1')?.get('sort')).toBe('priority')
    expect(requestFor(fetchMock, '2')?.has('active_only')).toBe(false)

    await act(async () => {
      latest!.setCredentialActiveOnly(true)
      latest!.setAiProviderActiveOnly(true)
      latest!.setCredentialSort('last_used_at')
      latest!.setAiProviderPageSize(20)
    })
    expect(latest).toMatchObject({
      credentialActiveOnly: true, aiProviderActiveOnly: true,
      credentialSort: 'last_used_at', aiProviderPageSize: 20,
    })
    expect(requestFor(fetchMock, '1')?.get('active_only')).toBe('true')
    expect(requestFor(fetchMock, '2')?.get('page_size')).toBe('20')
  })

  it.each(['SecurityError', 'QuotaExceededError'])('keeps existing and changed selections in memory when setItem throws %s', async (name) => {
    localStorage.setItem(CREDENTIAL_LIST_PREFERENCES_STORAGE_KEYS.credentials, JSON.stringify({
      version: 1, sort: 'last_used_at', pageSize: 50, providerFilter: 'claude',
    }))
    localStorage.setItem('cpa-usage-keeper-credentials-active-only', 'true')
    const storage = localStorage
    const setItem = vi.fn(() => { throw new DOMException('Storage write denied', name) })
    vi.stubGlobal('localStorage', { getItem: storage.getItem.bind(storage), setItem })
    await act(async () => root.render(<Harness />))
    expect(latest).toMatchObject({ credentialSort: 'last_used_at', credentialPageSize: 50, credentialActiveOnly: true })
    await act(async () => {
      latest!.setCredentialPage(4)
      latest!.setAiProviderPage(3)
    })
    await act(async () => {
      latest!.setCredentialActiveOnly(false)
      latest!.setAiProviderActiveOnly(true)
      latest!.setCredentialSort('total_tokens')
      latest!.setCredentialPageSize(20)
      latest!.setCredentialProviderFilter('codex')
      latest!.setAiProviderSort('last_used_at')
      latest!.setAiProviderPageSize(50)
      latest!.setAiProviderProviderFilter('openai')
    })
    expect(setItem).toHaveBeenCalled()
    expect(container.textContent).toBe('Credential lists remain mounted')
    expect(latest).toMatchObject({
      credentialPage: 1, aiProviderPage: 1,
      credentialActiveOnly: false, aiProviderActiveOnly: true,
      credentialSort: 'total_tokens', aiProviderSort: 'last_used_at',
      credentialPageSize: 20, aiProviderPageSize: 50,
      credentialProviderFilter: 'codex', aiProviderProviderFilter: 'openai',
    })
    expect(requestFor(fetchMock, '1')?.get('type')).toBe('codex')
    expect(requestFor(fetchMock, '2')?.get('active_only')).toBe('true')
    expect(JSON.parse(localStorage.getItem(CREDENTIAL_LIST_PREFERENCES_STORAGE_KEYS.credentials)!)).toMatchObject({
      sort: 'last_used_at', pageSize: 50, providerFilter: 'claude',
    })
  })
})