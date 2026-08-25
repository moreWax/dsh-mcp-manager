/**
 * Host side of the MCP Add plugin: owns the file write and the credential
 * store. Config rows carry REFERENCES to secrets; values live in the managed
 * credential store and never touch the profile YAML.
 */
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'

export interface AddServerRequest {
  serverName: string
  transport: 'stdio' | 'streamable-http'
  /** stdio: the command to spawn. */
  command?: string
  /** stdio: arguments for the command. */
  args?: string[]
  /** http: the MCP endpoint URL. */
  url?: string
  /** Optional API key — stored in the managed credential store, never in YAML. */
  apiKey?: string
}

/** Valid names become part of tool names: mcp__<serverName>__<tool>. */
const NAME_RE = /^[A-Za-z0-9_-]{1,32}$/

export class McpAddHost {
  constructor(private readonly ctx: Context) {}

  /** $DSH_HOME — matches dsh's convention with a sane default. */
  private dshHome(): string {
    return process.env.DSH_HOME ?? join(homedir(), '.dsh')
  }

  private profilePatchPath(): string {
    return join(this.dshHome(), 'profiles', process.env.DSH_PROFILE ?? 'default', 'cordis.patch.yml')
  }

  private credentialRefFor(serverName: string) {
    return credentialRef(`MCP_${serverName.toUpperCase().replaceAll('-', '_')}_KEY`)
  }

  async addServer(request: AddServerRequest): Promise<{ ok: true; envVar: string } | { ok: false; error: string }> {
    if (!NAME_RE.test(request.serverName)) {
      return { ok: false, error: `invalid server name "${request.serverName}": must match ${NAME_RE}` }
    }
    if (request.transport === 'stdio' && (request.command === undefined || request.command === '')) {
      return { ok: false, error: 'stdio transport requires a command' }
    }
    if (request.transport === 'streamable-http' && (request.url === undefined || !/^https?:\/\//.test(request.url))) {
      return { ok: false, error: 'http transport requires a valid http(s) URL' }
    }

    // 1. Store the API key in the managed credential store (never in YAML).
    const ref = this.credentialRefFor(request.serverName)
    if (request.apiKey !== undefined && request.apiKey !== '') {
      await this.ctx.credentials.set(ref, request.apiKey)
    }

    // 2. Append the config row with a REFERENCE to the credential.
    // CredentialRef is a branded string — the ref IS the env-var name.
    const envVar = ref as unknown as string
    const row = this.renderRow(request, envVar)
    const path = this.profilePatchPath()
    // idempotence: refuse duplicate ids
    const existing = await readFile(path, 'utf8').catch(() => '')
    if (existing.includes(`- id: mcp-${request.serverName}\n`)) {
      return { ok: false, error: `server "${request.serverName}" is already configured` }
    }
    await appendFile(path, `\n${row}\n`, 'utf8')
    return { ok: true, envVar }
  }

  /** Render one dsh-mcp-client row. The key travels by env reference only. */
  private renderRow(r: AddServerRequest, envVar: string): string {
    const envBlock = r.transport === 'stdio'
      ? `        env:\n          API_KEY: !!js process.env.${envVar} || ''\n`
      : `        headers:\n          Authorization: !!js \`Bearer \${process.env.${envVar} || ''}\`\n`
    if (r.transport === 'stdio') {
      const args = (r.args ?? []).map((a) => `'${a.replaceAll("'", "'\\''")}'`).join(', ')
      return [
        `- id: mcp-${r.serverName}`,
        `  name: '@deepseek-ai/dsh-mcp-client'`,
        `  config:`,
        `    serverName: ${r.serverName}`,
        `    transport: stdio`,
        `    command: ${r.command}`,
        ...(args !== '' ? [`    args: [${args}]`] : []),
        envBlock.trimEnd(),
      ].join('\n')
    }
    return [
      `- id: mcp-${r.serverName}`,
      `  name: '@deepseek-ai/dsh-mcp-client'`,
      `  config:`,
      `    serverName: ${r.serverName}`,
      `    transport: streamable-http`,
      `    url: ${r.url}`,
      `    # streamable-http (Streamable HTTP transport). The 2026-07-28 MCP spec`,
      `    # made the core stateless: no handshake/session-id; the SDK negotiates`,
      `    # the era automatically with both modern and 2025-era servers.`,
      envBlock.trimEnd(),
    ].join('\n')
  }

  /** List configured MCP servers from the profile patch (names only — no secrets). */
  async listServers(): Promise<string[]> {
    const path = this.profilePatchPath()
    const raw = await readFile(path, 'utf8').catch(() => '')
    const names: string[] = []
    for (const m of raw.matchAll(/- id: mcp-([A-Za-z0-9_-]{1,32})\n/g)) {
      names.push(m[1]!)
    }
    return names
  }

  /** Remove a server row and unset its credential. */
  async removeServer(serverName: string): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!NAME_RE.test(serverName)) return { ok: false, error: 'invalid server name' }
    const path = this.profilePatchPath()
    const raw = await readFile(path, 'utf8').catch(() => '')
    const marker = `- id: mcp-${serverName}\n`
    const idx = raw.indexOf(marker)
    if (idx === -1) return { ok: false, error: `server "${serverName}" not found` }
    // the row ends at the next top-level "- id:" or "- insert:" or EOF
    const rest = raw.slice(idx + marker.length)
    const nextRow = rest.search(/^(- (?:id|insert):)/m)
    const end = nextRow === -1 ? raw.length : idx + marker.length + nextRow
    const updated = raw.slice(0, idx) + raw.slice(end).replace(/^\n+/, '\n')
    await writeFile(path, updated, 'utf8')
    // also unset the stored credential (no-op if absent)
    await this.ctx.credentials.unset(this.credentialRefFor(serverName)).catch(() => {})
    return { ok: true }
  }
}

export const name = 'mcp-add-host'
export const inject = ['credentials'] as const

export function apply(ctx: Context): void {
  const host = new McpAddHost(ctx)
  // host RPC surface — the browser client calls these through the api channel
  void host
  void resolve
  void join
}
