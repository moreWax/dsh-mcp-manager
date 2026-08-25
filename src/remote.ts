import { z } from 'zod'
import type { AddServerRequest } from './types.js'
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'


type AddServerResult = { ok: true; envVar: string } | { ok: false; error: string }
type RemoveServerResult = { ok: true } | { ok: false; error: string }
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    mcpManager: {
      addServer(request: AddServerRequest): Promise<RemoteResult<AddServerResult>>
      listServers(): Promise<RemoteResult<string[]>>
      removeServer(serverName: string): Promise<RemoteResult<RemoveServerResult>>
    }
  }
}

const failure = z.object({ ok: z.literal(false), error: z.string() })
const addRequest = z.object({
  serverName: z.string(),
  transport: z.union([z.literal('stdio'), z.literal('streamable-http')]),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  apiKey: z.string().optional(),
})
const addResult = z.union([z.object({ ok: z.literal(true), envVar: z.string() }), failure])
const removeResult = z.union([z.object({ ok: z.literal(true) }), failure])

const parameter = (name: string, schema: z.ZodType) => ({
  name, wire: name, source: 'json' as const,
  codec: { mode: 'strict' as const, typeSymbol: `@morewax/dsh-mcp-manager#${name}`, schema },
})
const result = (name: string, schema: z.ZodType) => ({
  mode: 'strict' as const, typeSymbol: `@morewax/dsh-mcp-manager#${name}`, schema,
})

export const TYPERT_REMOTE: TypertRemoteContribution = {
  package: '@morewax/dsh-mcp-manager',
  descriptors: [
    { id: '@morewax/dsh-mcp-manager#mcpManager/addServer', service: 'mcpManager', namespace: 'mcpManager', method: 'addServer', invocation: { kind: 'direct' }, parameters: [parameter('request', addRequest)], result: result('AddServerResult', addResult) },
    { id: '@morewax/dsh-mcp-manager#mcpManager/listServers', service: 'mcpManager', namespace: 'mcpManager', method: 'listServers', invocation: { kind: 'direct' }, parameters: [], result: result('ListServersResult', z.array(z.string())) },
    { id: '@morewax/dsh-mcp-manager#mcpManager/removeServer', service: 'mcpManager', namespace: 'mcpManager', method: 'removeServer', invocation: { kind: 'direct' }, parameters: [parameter('serverName', z.string())], result: result('RemoveServerResult', removeResult) },
  ],
}
export default TYPERT_REMOTE
