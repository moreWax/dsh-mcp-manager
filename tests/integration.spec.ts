import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { apply as applyHost, McpManagerHost } from '../src/host/index.js'
import { apply as applyClient, createMcpManagerClientApi, inject } from '../src/client/index.js'
import remoteContribution from '../src/remote.js'

describe('host Remote service', () => {
  it('registers mcpManager and declares all methods for Typert', async () => {
    const ctx = new Context()
    ;(ctx as unknown as Record<string, unknown>).credentials = { set: vi.fn(), unset: vi.fn() }
    applyHost(ctx)
    await vi.waitFor(() => expect((ctx as unknown as { mcpManager?: unknown }).mcpManager).toBeInstanceOf(McpManagerHost))
    const service = (ctx as unknown as { mcpManager: McpManagerHost }).mcpManager
    expect(remoteMethods(service).map(method => method.method)).toEqual(['addServer', 'listServers', 'removeServer'])
  })
})

describe('client Remote and slot integration', () => {

  it('unwraps generated Remote results for the modal API', async () => {
    const remote = {
      mcpManager: {
        addServer: vi.fn(async () => ({ ok: true, value: { ok: true, envVar: 'MCP_X_KEY' } })),
        listServers: vi.fn(async () => ({ ok: true, value: ['x'] })),
        removeServer: vi.fn(async () => ({ ok: false, error: { message: 'offline' } })),
      },
    }
    const api = createMcpManagerClientApi({ remote } as unknown as Context)
    expect(await api.addServer({ serverName: 'x', transport: 'stdio', command: 'x' })).toEqual({ ok: true, envVar: 'MCP_X_KEY' })
    expect(await api.listServers()).toEqual(['x'])
    expect(await api.removeServer('x')).toEqual({ ok: false, error: 'offline' })
  })

  it('mounts its contribution and registers the button in conversation.input.left', async () => {
    const mounted = vi.fn(async () => vi.fn(async () => {}))
    const register = vi.fn(() => vi.fn())
    const injectSlot = vi.fn((_key: string, callback: () => unknown) => callback())
    const ctx = {
      remote: { $mount: mounted },
      slots: { inject: injectSlot, register },
    } as unknown as Context
    await applyClient(ctx)
    expect(inject).toEqual(['slots', 'remote'])
    expect(mounted).toHaveBeenCalledWith(remoteContribution)
    expect(injectSlot).toHaveBeenCalledWith('conversation.input.left', expect.any(Function))
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ name: 'conversation.input.left', id: 'mcp-manager' }), expect.any(Function))
  })
})
