/**
 * Host side of the MCP Add plugin: owns the profile mutation and credential
 * coordination. Config rows carry references; secret values never enter YAML.
 */
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { ProfilePatchStore } from './profile-store.js'
import {
  SERVER_NAME_PATTERN,
  renderServerRow,
  validateAddServerRequest,
} from './request.js'
import type { AddServerRequest } from '../types.js'

export type { AddServerRequest } from '../types.js'

export class McpManagerHost extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'mcpManager')
  }

  private profileStore(): ProfilePatchStore {
    const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
    const profile = process.env.DSH_PROFILE ?? 'default'
    return new ProfilePatchStore(join(home, 'profiles', profile, 'cordis.patch.yml'))
  }

  private credentialRefFor(serverName: string) {
    return credentialRef(`MCP_${serverName.toUpperCase().replaceAll('-', '_')}_KEY`)
  }

  @Remote('addServer')
  async addServer(request: AddServerRequest): Promise<{ ok: true; envVar: string } | { ok: false; error: string }> {
    const validationError = validateAddServerRequest(request)
    if (validationError !== undefined) return { ok: false, error: validationError }

    const store = this.profileStore()
    if (await store.hasServer(request.serverName)) {
      return { ok: false, error: `server "${request.serverName}" is already configured` }
    }

    const ref = this.credentialRefFor(request.serverName)
    if (request.apiKey !== undefined && request.apiKey !== '') {
      await this.ctx.credentials.set(ref, request.apiKey)
    }
    const envVar = ref as unknown as string
    await store.appendServer(renderServerRow(request, envVar))
    return { ok: true, envVar }
  }

  @Remote('listServers')
  async listServers(): Promise<string[]> {
    return this.profileStore().listServers()
  }

  @Remote('removeServer')
  async removeServer(serverName: string): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!SERVER_NAME_PATTERN.test(serverName)) return { ok: false, error: 'invalid server name' }
    if (!await this.profileStore().removeServer(serverName)) {
      return { ok: false, error: `server "${serverName}" not found` }
    }
    await this.ctx.credentials.unset(this.credentialRefFor(serverName)).catch(() => {})
    return { ok: true }
  }
}

export const name = 'mcp-manager-host'
export const inject = ['credentials'] as const

export function apply(ctx: Context): void {
  new McpManagerHost(ctx)
}
