# claude-meta-mcp

> Self-hosted Meta Ads (Facebook & Instagram) connector for Claude.
> Bring your campaign data into Claude conversations — no SaaS middleman, no per-seat pricing, your tokens stay on your server.

[![CI](https://github.com/maxx3250/claude-meta-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/maxx3250/claude-meta-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Streamable_HTTP-blue.svg)](https://modelcontextprotocol.io/)
[![Status](https://img.shields.io/badge/status-v0.2_alpha-orange.svg)](./CHANGELOG.md)

> **Status — v0.2.0 (single-tenant alpha).**
> One Meta System User token, one shared Bearer secret, no database. Perfect for personal use or a single agency account. Multi-tenant + OAuth 2.1 + DCR are on the roadmap (see [Roadmap](#roadmap)).

---

## Why?

Existing options for connecting Meta Ads to Claude are either:

- **SaaS-only** (Windsor.ai, Pipeboard) — your ad data flows through a third-party platform, monthly fees, vendor lock-in.
- **Local-only** (most community MCP servers) — stdio transport, only works in Claude Desktop, can't be installed as a remote connector in claude.ai web.

`claude-meta-mcp` is a small, self-hostable Node service that:

- Speaks **MCP Streamable HTTP**, so it works with claude.ai web and Claude Desktop alike.
- Reads Meta Ads (campaigns, ad sets, ads, creatives, insights) and reads+writes Facebook Page posts. Ads side stays read-only.
- Is **MIT licensed** — fork it, sell it, embed it.

---

## Quick start

### Prerequisites

- Node.js ≥ 20
- A Meta Developer App with a **System User token** that has `ads_read`, `business_management` and the relevant `pages_*` scopes
  → see [`docs/META_APP_SETUP.md`](./docs/META_APP_SETUP.md) for the full step-by-step
- A public HTTPS URL (Claude requires HTTPS for custom connectors)

### Install

```bash
git clone https://github.com/maxx3250/claude-meta-mcp.git
cd claude-meta-mcp
npm install
cp .env.example .env
# fill in META_ACCESS_TOKEN and generate AUTH_TOKEN:
echo "AUTH_TOKEN=$(openssl rand -hex 32)" >> .env
npm run build
node --env-file=.env dist/index.js
```

The server listens on `PORT` (default `3210`) and exposes:

- `GET /health` — liveness probe (no auth)
- `POST /mcp` — MCP Streamable HTTP transport (Bearer auth)

### Connect to Claude

1. Put the service behind a reverse proxy that terminates TLS — see [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).
2. In Claude → **Settings → Connectors → Add custom connector**.
3. URL: `https://your-domain.example.com/mcp`
4. Add header `Authorization: Bearer <your AUTH_TOKEN>` in the connector's advanced settings.
5. Save. Tools should appear in the connector list.

---

## Available tools

13 tools in v0.2 — Ads are read-only, Pages can be read **and written**.

### Meta Ads (read-only)

| Tool | What it does |
|---|---|
| `list_ad_accounts` | List ad accounts the token has access to |
| `get_ad_account` | Fetch one ad account's details (balance, currency, spend cap, …) |
| `list_campaigns` | List campaigns inside an ad account, optionally filtered by status |
| `get_campaign` | Fetch one campaign's full configuration |
| `list_adsets` | List ad sets under a campaign or an ad account |
| `list_ads` | List ads under a campaign, ad set, or ad account |
| `get_insights` | Performance metrics (impressions, clicks, spend, CTR, CPC, CPM, reach, conversions) at any level, with date presets / custom ranges and breakdowns |
| `list_creatives` | List ad creatives inside an ad account |

### Facebook Pages (read & write)

| Tool | What it does |
|---|---|
| `list_pages` | List Facebook Pages the System User manages |
| `list_page_posts` | List recent posts on a Page (newest first) |
| `get_page_insights` | Page-level metrics (impressions, engagement, follows, page views) |
| `create_page_post` ⚠️ | **Write** — publishes a new post on a Page (text + optional link) |
| `delete_page_post` ⚠️ | **Destructive** — deletes a post from a Page |

`get_insights` is the workhorse. Examples (in plain English from Claude):

- *"What did we spend in the last 7 days, broken down by campaign?"*
- *"Compare CTR across publisher_platform breakdown for campaign 12345 last month."*
- *"Which ad sets had the worst CPM yesterday?"*

---

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `META_ACCESS_TOKEN` | yes | — | Meta System User token (recommended, never expires) or long-lived user access token. Required scopes: `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_metadata` |
| `META_API_VERSION` | no | `v22.0` | Graph API version |
| `AUTH_TOKEN` | yes | — | Shared bearer secret for `POST /mcp`. Generate with `openssl rand -hex 32` |
| `PUBLIC_URL` | no | `http://localhost:3210` | Public URL (currently informational; v0.2 will use it for OAuth callbacks) |
| `PORT` | no | `3210` | TCP port to bind |
| `LOG_LEVEL` | no | `info` | `debug` / `info` / `warn` / `error` |

See [`.env.example`](./.env.example).

---

## How is this different from … ?

| | claude-meta-mcp | Windsor.ai | Pipeboard | hashcott/meta-ads-mcp-server |
|---|---|---|---|---|
| Self-hosted | ✓ | ✗ | ✗ | ✓ |
| Remote claude.ai web | ✓ | ✓ | ✓ | partial |
| License | **MIT** | proprietary | BSL 1.1 | MIT |
| Your data leaves your server | ✗ | ✓ | ✓ | ✗ |
| Monthly fee | $0 | from $19 | from $29 | $0 |

<sub>As of May 2026, based on each project's public README and pricing page. Names and trademarks belong to their respective owners; comparison is informational only.</sub>

---

## Architecture (v0.2)

```
┌─────────────────────┐     POST /mcp        ┌──────────────────────────┐
│  Claude.ai / Desktop│ ──────────────────►  │  Express + MCP server    │
│                     │  Bearer AUTH_TOKEN   │  StreamableHTTPTransport │
└─────────────────────┘                      │           │              │
                                             │           ▼              │
                                             │  Meta Graph API client   │
                                             │  (axios, v22.0)          │
                                             └─────────────┬────────────┘
                                                           │
                                                           ▼
                                             https://graph.facebook.com
```

No database. No state between requests. One Meta System User token, one Bearer token, 13 tools.

For sequence diagrams and the planned v1.0 multi-tenant architecture, see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Roadmap

**v0.2 — proper auth**
- [ ] OAuth 2.1 with Dynamic Client Registration on the Claude side
- [ ] `.well-known/oauth-authorization-server` discovery endpoint
- [ ] Token issuance + refresh

**v0.3 — multi-tenant**
- [ ] Meta OAuth user flow + 60-day token refresh
- [ ] SQLite (then Postgres) for user → meta-token mapping
- [ ] AES-256-GCM encryption at rest for stored tokens

**v0.4 — performance**
- [ ] Insights pre-aggregation cache with smart invalidation
- [ ] Background refresh for "yesterday and earlier" data

**v1.0 — production-ready**
- [ ] Audit log, rate limiting per tenant
- [ ] Prometheus `/metrics` endpoint
- [ ] Health checks for downstream Meta API

**Stretch**
- [ ] Google Ads connector under the same umbrella
- [ ] TikTok Ads connector
- [ ] LinkedIn Ads connector

---

## Project layout

```
src/
├── index.ts          Express + MCP bootstrap, Bearer middleware
├── config.ts         Env validation
├── meta-client.ts    Graph API axios wrapper + pagination helper
└── tools.ts          Tool registry (13 tools, Zod schemas)

docs/
├── ARCHITECTURE.md
├── DEPLOYMENT.md
└── META_APP_SETUP.md

ecosystem.config.cjs  pm2 example
.env.example          Configuration template
```

---

## Development

```bash
npm run dev       # tsx watch mode
npm run build     # tsc → dist/
npm start         # node dist/index.js
```

---

## Security notes

- The Bearer token in `AUTH_TOKEN` is a single shared secret. Anyone with it can read your Meta ad data **and publish/delete Facebook Page posts** through the connector. Treat it like a database password.
- The connector requests **read-only** scopes for Ads (`ads_read`) but **write** scopes for Pages (`pages_manage_posts`). If you don't want write access, you can remove the `pages_manage_posts` permission from your System User and the `create_page_post`/`delete_page_post` tools will fail with a 403.
- Always run behind HTTPS. Claude refuses to connect to non-TLS connectors anyway.
- Rotate `AUTH_TOKEN` by editing `.env` and restarting the process.
- Rotate `META_ACCESS_TOKEN` by revoking the System User token in Meta Business and minting a new one.

If you find a security issue, please email `security@markusstoeger.com` instead of opening a public issue.

---

## Contributing

PRs welcome. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for ground rules and
[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). Security issues should follow
[`SECURITY.md`](./SECURITY.md), not the public issue tracker.

---

## License

[MIT](./LICENSE) © 2026 Markus Stöger

---

## Acknowledgements

Inspired by the open MCP ecosystem and prior art in
[hashcott/meta-ads-mcp-server](https://github.com/hashcott/meta-ads-mcp-server),
[pipeboard-co/meta-ads-mcp](https://github.com/pipeboard-co/meta-ads-mcp),
and the [Model Context Protocol](https://modelcontextprotocol.io/) team.
