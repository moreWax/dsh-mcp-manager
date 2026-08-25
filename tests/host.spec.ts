import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { McpManagerHost } from '../src/host/index.js'

let home: string
let ctx: Context
let stored: Map<string, string>

/** Credential store double: records set/unset; resolve yields what was set. */
function mountCredentialDouble(context: Context): void {
  stored = new Map()
  ;(context as unknown as Record<string, unknown>).credentials = {
    // CredentialRef is a branded string: the ref IS the env-var name.
    async set(ref: string, value: string) { stored.set(ref, value) },
    async unset(ref: string) { stored.delete(ref) },
    async resolve(ref: string) {
      const value = stored.get(ref)
      return value === undefined || value === '' ? undefined : { value, source: 'file' }
    },
  }
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'dsh-home-'))
  process.env.DSH_HOME = home
  await mkdir(join(home, 'profiles', 'default'), { recursive: true })
  await writeFile(join(home, 'profiles', 'default', 'cordis.patch.yml'), '# profile\n', 'utf8')
  ctx = new Context()
  mountCredentialDouble(ctx)
})

afterEach(() => {
  delete process.env.DSH_HOME
  delete process.env.DSH_PROFILE
})

describe('McpManagerHost.addServer', () => {
  it('writes a stdio row referencing the credential store, never the value', async () => {
    const host = new McpManagerHost(ctx)
    const result = await host.addServer({
      serverName: 'github', transport: 'stdio',
      command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'],
      apiKey: 'ghp-secret-value-123',
    })
    expect(result).toEqual({ ok: true, envVar: 'MCP_GITHUB_KEY' })

    const yaml = await readFile(join(home, 'profiles', 'default', 'cordis.patch.yml'), 'utf8')
    expect(yaml).toContain('- id: mcp-github')
    expect(yaml).toContain("name: '@morewax/dsh-mcp-client'")
    expect(yaml).toContain('serverName: github')
    expect(yaml).toContain('command: npx')
    // THE security property: the secret value NEVER appears in the config
    expect(yaml).not.toContain('ghp-secret-value-123')
    // only the env-var REFERENCE rides along
    expect(yaml).toContain('process.env.MCP_GITHUB_KEY')
  })

  it('stores the key in the credential store', async () => {
    const host = new McpManagerHost(ctx)
    await host.addServer({
      serverName: 'linear', transport: 'stdio', command: 'npx', apiKey: 'lin_api_secret',
    })
    expect(stored.get('MCP_LINEAR_KEY')).toBe('lin_api_secret')
  })

  it('writes an http row with a bearer header reference', async () => {
    const host = new McpManagerHost(ctx)
    const result = await host.addServer({
      serverName: 'web', transport: 'streamable-http', url: 'http://localhost:3000/mcp',
      apiKey: 'tok-abc',
    })
    expect(result).toMatchObject({ ok: true, envVar: 'MCP_WEB_KEY' })
    const yaml = await readFile(join(home, 'profiles', 'default', 'cordis.patch.yml'), 'utf8')
    expect(yaml).toContain('url: http://localhost:3000/mcp')
    expect(yaml).toContain('Bearer')
    expect(yaml).not.toContain('tok-abc')
  })

  it('rejects duplicate server ids', async () => {
    const host = new McpManagerHost(ctx)
    await host.addServer({ serverName: 'dup', transport: 'stdio', command: 'x' })
    const again = await host.addServer({ serverName: 'dup', transport: 'stdio', command: 'x' })
    expect(again).toMatchObject({ ok: false })
  })

  it('rejects invalid names and missing required fields', async () => {
    const host = new McpManagerHost(ctx)
    expect(await host.addServer({ serverName: 'bad name!', transport: 'stdio', command: 'x' })).toMatchObject({ ok: false })
    expect(await host.addServer({ serverName: 'ok', transport: 'stdio' })).toMatchObject({ ok: false })
    expect(await host.addServer({ serverName: 'ok', transport: 'streamable-http', url: 'not-a-url' })).toMatchObject({ ok: false })
  })
})

describe('McpManagerHost.listServers / removeServer', () => {
  it('round-trips add → list → remove, cleaning the credential', async () => {
    const host = new McpManagerHost(ctx)
    await host.addServer({ serverName: 'one', transport: 'stdio', command: 'a', apiKey: 'k1' })
    await host.addServer({ serverName: 'two', transport: 'stdio', command: 'b' })
    expect(await host.listServers()).toEqual(['one', 'two'])

    const removed = await host.removeServer('one')
    expect(removed).toEqual({ ok: true })
    expect(await host.listServers()).toEqual(['two'])
    expect(stored.has('MCP_ONE_KEY')).toBe(false)  // credential cleaned up too
    expect(stored.get('MCP_TWO_KEY')).toBe(undefined)  // never had one
  })

  it('removing an absent server reports an error', async () => {
    const host = new McpManagerHost(ctx)
    expect(await host.removeServer('ghost')).toMatchObject({ ok: false })
  })
})
