import type { AddServerRequest } from '../types.js'

export const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

export function validateAddServerRequest(request: AddServerRequest): string | undefined {
  if (!SERVER_NAME_PATTERN.test(request.serverName)) {
    return `invalid server name "${request.serverName}": must match ${SERVER_NAME_PATTERN}`
  }
  if (request.transport === 'stdio' && (request.command === undefined || request.command === '')) {
    return 'stdio transport requires a command'
  }
  if (request.transport === 'streamable-http' && (request.url === undefined || !/^https?:\/\//.test(request.url))) {
    return 'http transport requires a valid http(s) URL'
  }
  return undefined
}

export function renderServerRow(request: AddServerRequest, envVar: string): string {
  const envBlock = request.transport === 'stdio'
    ? `        env:
          API_KEY: !!js process.env.${envVar} || ''
`
    : `        headers:
          Authorization: !!js \`Bearer \${process.env.${envVar} || ''}\`
`

  if (request.transport === 'stdio') {
    const args = (request.args ?? []).map((arg) => `'${arg.replaceAll("'", "'\\''")}'`).join(', ')
    return [
      `- id: mcp-${request.serverName}`,
      `  name: '@morewax/dsh-mcp-client'`,
      `  config:`,
      `    serverName: ${request.serverName}`,
      `    transport: stdio`,
      `    command: ${request.command}`,
      ...(args === '' ? [] : [`    args: [${args}]`]),
      envBlock.trimEnd(),
    ].join('\n')
  }

  return [
    `- id: mcp-${request.serverName}`,
    `  name: '@morewax/dsh-mcp-client'`,
    `  config:`,
    `    serverName: ${request.serverName}`,
    `    transport: streamable-http`,
    `    url: ${request.url}`,
    `    # streamable-http (Streamable HTTP transport). The 2026-07-28 MCP spec`,
    `    # made the core stateless: no handshake/session-id; the SDK negotiates`,
    `    # the era automatically with both modern and 2025-era servers.`,
    envBlock.trimEnd(),
  ].join('\n')
}
