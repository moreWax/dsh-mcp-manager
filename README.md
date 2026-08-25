# dsh-mcp-add

**Add MCP servers from the harness UI** — a `+` button beside the composer,
like the server settings in the Codex and Claude Code desktop apps.

```
┌──────────────────────────────────────────┐
│  composer                     [+ Add]    │
└──────────────────────────────────────────┘
      ↓ click → modal
  Name / Command-or-URL / API key (optional)
      ↓ Add
  key → managed credential store (never in config)
  row → profile cordis.patch.yml (reference only)
      ↓ HMR
  server connects live; tools appear next message
```

## Transport

Both transports target the **current MCP protocol**:

- `stdio` — local process, unchanged across spec revisions.
- `streamable-http` — the Streamable HTTP transport. The MCP **2026-07-28
  specification** made the protocol core **stateless**: no `initialize`
  handshake, no `Mcp-Session-Id` header, every request self-describing with
  `Mcp-Method`/`Mcp-Name` headers, plus MRTR (multi round-trip requests) for
  mid-call input and cacheable `tools/list` results. The v2 TypeScript SDK
  (`@modelcontextprotocol/client@2.x`) implements it natively, with era
  negotiation so modern clients still work with 2025-era servers (and vice
  versa) during the spec's twelve-month deprecation windows.

Generated rows name **`@morewax/dsh-mcp-client`** — our drop-in client built
on the v2 SDK that speaks the 2026-07-28 stateless protocol natively (with
automatic era fallback to 2025-era servers). This plugin only writes the
connection row; the protocol code lives in that package. The deprecated
HTTP+SSE transport is not used anywhere.

## Security model

- **Secrets never touch config files.** The API key is written to dsh's
  managed credential store (`ctx.credentials.set` → `$DSH_HOME/.credentials.yaml`),
  and the MCP row references it by environment-variable name
  (`process.env.MCP_GITHUB_KEY`). The profile YAML stays safe to commit, sync,
  and render — this is dsh's own doctrine, verbatim.
- **Removing a server unsets its credential.**
- **Per-request resolution**: because `ctx.credentials.resolve` runs per
  operation, rotating a key takes effect on the next request with no restart.

## Install

```sh
dsh plugin --profile default add github:moreWax/dsh-mcp-add
```

## Development

```sh
pnpm install
pnpm test        # host logic: add/list/remove, credential storage, YAML safety
pnpm build
```
