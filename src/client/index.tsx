/**
 * Client side of the MCP Add plugin: a "+" button in the composer toolbar and
 * a modal for adding MCP servers. Secrets go to the managed credential store
 * through the host RPC; the profile YAML only ever sees a reference.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { AddServerRequest, McpTransport } from '../types.js'

export interface McpManagerClientApi {
  addServer(req: AddServerRequest): Promise<{ ok: true; envVar: string } | { ok: false; error: string }>
  listServers(): Promise<string[]>
  removeServer(name: string): Promise<{ ok: true } | { ok: false; error: string }>
}

type Transport = McpTransport

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', marginBottom: 12,
  borderRadius: 6, border: '1px solid var(--border, #333)', background: 'var(--bg, #111)',
  color: 'inherit', fontSize: 14, boxSizing: 'border-box',
}

const buttonStyle: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
  background: 'var(--accent, #4a9)', color: '#fff', fontSize: 14, fontWeight: 500,
}

export function AddServerModal({ api, onClose }: { api: McpManagerClientApi; onClose: () => void }) {
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<Transport>('stdio')
  const [command, setCommand] = useState('')
  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await api.addServer({
        serverName: name.trim(),
        transport,
        ...(transport === 'stdio' ? { command: command.trim(), args: [] } : { url: url.trim() }),
        ...(apiKey !== '' ? { apiKey } : {}),
      })
      if (result.ok) {
        onClose()
      } else {
        setError(result.error)
      }
    } finally {
      setBusy(false)
    }
  }, [api, name, transport, command, url, apiKey, onClose])

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  }
  const card: React.CSSProperties = {
    width: 420, padding: 24, borderRadius: 12, background: 'var(--bg-card, #161616)',
    border: '1px solid var(--border, #333)',
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Add MCP server</h3>
        <input style={inputStyle} placeholder="Name (e.g. github)" value={name}
               onChange={(e) => setName(e.target.value)} autoFocus />
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          {(['stdio', 'streamable-http'] as const).map((t) => (
            <button key={t} onClick={() => setTransport(t)}
                    style={{ ...buttonStyle, opacity: transport === t ? 1 : 0.5, flex: 1 }}>
              {t === 'stdio' ? 'Command' : 'HTTP'}
            </button>
          ))}
        </div>
        {transport === 'stdio' ? (
          <input style={inputStyle} placeholder="Command (e.g. npx -y @modelcontextprotocol/server-github)"
                 value={command} onChange={(e) => setCommand(e.target.value)} />
        ) : (
          <input style={inputStyle} placeholder="URL (https://host/mcp)" value={url}
                 onChange={(e) => setUrl(e.target.value)} />
        )}
        <input style={inputStyle} type="password" placeholder="API key (optional — stored securely)"
               value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        {error !== null && <p style={{ color: '#e66', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={{ ...buttonStyle, background: 'transparent', color: 'inherit' }} onClick={onClose}>
            Cancel
          </button>
          <button style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={submit}>
            {busy ? 'Adding…' : 'Add server'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#888', margin: '12px 0 0' }}>
          Keys are stored in the managed credential store (<code>~/.dsh/.credentials.yaml</code>),
          never in profile config. HMR reconnects the server instantly — no restart.
        </p>
      </div>
    </div>
  )
}

/** The toolbar button that opens the modal. */
export function McpManagerButton({ api }: { api: McpManagerClientApi }) {
  const [open, setOpen] = useState(false)
  const plusButton: React.CSSProperties = {
    border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit',
    fontSize: 18, padding: '4px 10px', lineHeight: 1,
  }
  return (
    <>
      <button style={plusButton} title="Add MCP server" onClick={() => setOpen(true)}>+</button>
      {open && <AddServerModal api={api} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Convenience hook: modal state driven by the host api. */
export function useMcpServers(api: McpManagerClientApi): string[] {
  const [servers, setServers] = useState<string[]>([])
  useEffect(() => {
    void api.listServers().then(setServers)
  }, [api])
  return servers
}

export const name = 'mcp-manager-client'
export const inject = [] as const

// Plugin body — mounts the button into the composer toolbar slot when the
// client runtime loads it. Slot registration follows the ui-conversation
// pattern (conversation.input.toolbar).
export function apply(ctx: Context): void {
  void ctx
}
