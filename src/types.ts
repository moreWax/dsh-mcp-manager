export type McpTransport = 'stdio' | 'streamable-http'

export interface AddServerRequest {
  serverName: string
  transport: McpTransport
  /** stdio: the command to spawn. */
  command?: string
  /** stdio: arguments for the command. */
  args?: string[]
  /** http: the MCP endpoint URL. */
  url?: string
  /** Optional API key — stored in the managed credential store, never in YAML. */
  apiKey?: string
}
