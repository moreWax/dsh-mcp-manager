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
