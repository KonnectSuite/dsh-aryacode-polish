# MCP servers

Settings → **MCP servers** manages the Model Context Protocol servers AryaCode
connects to. It is the `mcpManager` feature of this bundle, on by default.

## What it looks like

The page, with one stdio server mounted and healthy:

![The MCP servers page](mcp/mcp-01-overview.png)

Four ways in — the bundled catalog:

![The catalog tab](mcp/mcp-02-catalog.png)

GitHub search, live and unauthenticated in this capture:

![GitHub search](mcp/mcp-03-github.png)

The detail drawer: what the entry is, and the actions for it:

![The details drawer](mcp/mcp-04-details.png)

The tools the model actually sees, read from the live registry:

![The tools tab](mcp/mcp-05-tools.png)

Export renders the whole list in the page, ready to select or copy:

![The export panel](mcp/mcp-06-export.png)

These captures come from the development app on 2026-10-31, version 0.105.4,
with `@modelcontextprotocol/server-memory` installed through the catalog.
## What the page does

- **Lists every server** in the profile with live health (`ready`, `connecting`,
  `error`, `disabled`) and the tools it contributes.
- **Adds servers four ways**: the bundled catalog (40 known servers), a GitHub
  search, a paste box that understands a command line, a URL or JSON, and a
  manual form for anything else.
- **Tests before saving**: the draft is mounted in a throwaway fiber, the first
  tool sync is awaited (20 s cap), and the answer says how many tools arrived.
- **Enables, disables, restarts and removes** without restarting AryaCode.
- **Shows servers another plugin mounted** (for example the Windows computer-use
  server, whose tools are `mcp__wincu__*`) as read-only cards, so the page never
  hides a namespace the model can see.

## How a server is mounted

Each enabled server mounts `@deepseek-ai/dsh-mcp-client` — the harness's own MCP
bridge — as a child plugin of this feature, with the bridge's documented config:

```js
ctx.plugin(mcpClient, {
  transport: 'stdio',          // or 'streamable-http'
  serverName: 'github',        // tools appear as mcp__github__<tool>
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_PERSONAL_ACCESS_TOKEN: '…' },
  failOnStartupError: true,
  reconnect: { enabled: true },
})
```

The bridge registers the server's tools on `ctx.tools` and its resources on
`ctx.mcpResources`, so the model gets tools *and* the three shared resource tools
(`list_mcp_resources`, `list_mcp_resource_templates`, `read_mcp_resource`).
Removing or disabling a server disposes the fiber; the tools disappear with it.

## Why a JSON file and not profile rows

A `cordis.patch.yml` row is the canonical shape for a plugin, and this bundle
would prefer it. Two facts stop it:

1. `configForms` writes only **volatile** fields, and the bridge's `Config` has
   none — a row-based editor in the app cannot save one.
2. A plugin cannot create a loader row at all; `configEditor` edits existing
   entries only.

So the list lives at `$DSH_HOME/mcp-servers.json`, written atomically, and the
bridge is mounted at runtime. The trade-off is honest: these servers do not
appear in the Plugins page, and `dsh --dump-config` does not show them. If the
harness ever exposes row creation to plugins, moving the store onto rows is a
contained change — `mcp/manager.js` is the only module that mounts anything.

## The list file

```json
{
  "version": 1,
  "servers": [
    {
      "id": "srv_lk3f9a",
      "serverName": "github",
      "label": "GitHub",
      "enabled": true,
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "…" },
      "toolCallTimeoutMs": 60000,
      "failOnStartupError": true,
      "reconnect": { "enabled": true },
      "category": "dev",
      "source": "catalog:github"
    }
  ]
}
```

- **Secrets are stored in plain text** in that file, mode `0600` where the
  platform honours it. The page masks anything whose key looks like a token, key,
  secret, password or authorization header before it reaches the browser.
- A corrupt file is renamed `mcp-servers.json.corrupt-<timestamp>` and the page
  starts empty instead of failing.
- Deleting a server removes its entry; it does not uninstall anything.

## Failure modes, and what the page says

| Symptom | Cause | What you see |
|---|---|---|
| `command not found` | the command in the entry does not exist | card `error` with the OS message; the model simply has no tools from that server |
| `Test failed: No tool sync within 20s` | a slow or hung server | the draft is disposed; nothing is saved |
| `GitHub rate limit reached` | unauthenticated GitHub search | the GitHub tab says so; the catalog and manual form keep working |
| `The MCP bridge is not available in this build` | a host without `@deepseek-ai/dsh-mcp-client` | a banner on the page; everything else still renders |
| `"x" is already used by "y"` | duplicate `serverName` | the form marks the field before saving |

## What it does not do

- **No resource browser.** `mcpResources` exposes `register()` only, so the page
  shows the tools a server contributes and the model keeps using the three shared
  resource tools for documents.
- **No MCP prompt templates** — the bridge itself does not support them.
- **No MCP server mode.** AryaCode consumes MCP; it publishes ACP and the SDK
  JSON-RPC surface instead.
