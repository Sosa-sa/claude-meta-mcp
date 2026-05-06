# Architecture

This document describes both the **current v0.1 architecture** (what's actually shipping today) and the **planned v1.0 architecture** (what the roadmap is building towards).

---

## Current — v0.1 (single-tenant, stateless)

A single Node process, no database, one Meta token, one Bearer secret.

```
┌─────────────────────┐                    ┌────────────────────────────┐
│ Claude.ai / Desktop │                    │  claude-meta-mcp           │
│                     │  POST /mcp         │  ┌──────────────────────┐  │
│                     │  Bearer AUTH_TOKEN │  │ Express              │  │
│                     │ ─────────────────► │  │  ├─ bearerAuth mw    │  │
│                     │                    │  │  └─ /mcp handler     │  │
│                     │                    │  │      │               │  │
│                     │                    │  │      ▼               │  │
│                     │                    │  │ McpServer            │  │
│                     │                    │  │  └─ 8 tool handlers  │  │
│                     │                    │  │      │               │  │
│                     │                    │  │      ▼               │  │
│                     │                    │  │ MetaClient (axios)   │  │
│                     │                    │  └──────────┬───────────┘  │
│                     │                    │             │              │
│                     │                    └─────────────┼──────────────┘
│                     │                                  ▼
│                     │                  https://graph.facebook.com/v22.0
└─────────────────────┘
```

### Source map

| File | LOC | Responsibility |
|---|---|---|
| `src/index.ts` | ~140 | Express bootstrap, Bearer auth middleware, MCP transport |
| `src/config.ts` | ~45 | Environment variable loading and validation |
| `src/meta-client.ts` | ~110 | Graph API client with axios + pagination + error wrapping |
| `src/tools.ts` | ~260 | 8 tool definitions with Zod schemas |

### Request flow

1. Claude sends a JSON-RPC request to `POST /mcp` with `Authorization: Bearer <AUTH_TOKEN>`.
2. The `bearerAuth` middleware compares against `config.authToken`. Wrong / missing → 401.
3. Express creates a fresh `StreamableHTTPServerTransport` per request (stateless mode, `sessionIdGenerator: undefined`).
4. The transport hands the request to the `McpServer`, which dispatches to the matching tool handler.
5. The tool handler invokes `MetaClient.get(...)`, which calls `https://graph.facebook.com/v22.0/...` with `access_token=<META_ACCESS_TOKEN>` appended.
6. The Graph API response is wrapped as MCP `text` content (JSON.stringify) and streamed back.
7. On any axios error, `MetaClient` rewraps as `MetaApiError` (HTTP 502 to client) with the original Meta error code/message intact.

### What's not here yet

- No OAuth flow on either side. Bearer auth is a single shared secret.
- No persistence. No cache. No multi-tenant data model.
- No metrics endpoint. Logging is JSON to stderr.
- No rate limiting (rely on nginx for that).

---

## Planned — v1.0 (multi-tenant, OAuth 2.1, cached)

The same shape, with two OAuth flows added and a Postgres state layer.

```
┌─────────────────────────────────────────────────────────┐
│                  claude-meta-mcp                        │
│                                                         │
│  Express HTTP server                                    │
│   ├── /.well-known/oauth-authorization-server  (meta)   │
│   ├── /oauth/register                          (DCR)    │
│   ├── /oauth/authorize                         (PKCE)   │
│   ├── /oauth/token                                      │
│   ├── /auth/meta/start                                  │
│   ├── /auth/meta/callback                               │
│   ├── /mcp                                     (MCP)    │
│   └── /health                                           │
│                                                         │
│  Tool registry  ─►  Insights cache  ─►  Graph API client│
│                                                         │
│  Postgres: tenants, oauth_clients, sessions,            │
│            meta_tokens (encrypted), insights_cache      │
└─────────────────────────────────────────────────────────┘
```

### Two OAuth flows

There are two **independent** OAuth flows in play. They are easy to confuse.

#### Flow A — Claude authenticates against the connector (OAuth 2.1 + DCR)

This is what makes the connector usable as a one-click "Add custom connector" in Claude, replacing the v0.1 shared bearer secret.

```
Claude.ai                         claude-meta-mcp
   │                                     │
   │  GET /.well-known/oauth-…           │
   │ ───────────────────────────────────►│
   │  ◄───────────  metadata             │
   │                                     │
   │  POST /oauth/register               │
   │ ───────────────────────────────────►│   ← Dynamic Client Registration
   │  ◄───────────  client_id            │      (RFC 7591)
   │                                     │
   │  redirect user to /oauth/authorize  │
   │  with PKCE code_challenge           │
   │ ───────────────────────────────────►│
   │                                     │
   │  ──── (user logs in,                │
   │        we kick off Meta OAuth) ──── │
   │                                     │
   │  ◄───  redirect with code           │
   │                                     │
   │  POST /oauth/token (code + verifier)│
   │ ───────────────────────────────────►│
   │  ◄───────────  access_token         │
   │                                     │
   │  POST /mcp  (Bearer token)          │
   │ ───────────────────────────────────►│   ← MCP traffic
```

#### Flow B — User authorizes Meta Graph API access

The first time a tenant connects, we redirect them to Facebook to grant `ads_read`. The resulting long-lived token is encrypted and stored in `meta_tokens`.

```
User browser                    claude-meta-mcp                   Facebook
     │                                  │                             │
     │  GET /auth/meta/start            │                             │
     │ ────────────────────────────────►│                             │
     │  ◄── 302 to facebook.com/dialog  │                             │
     │                                                                │
     │  ─── user grants ads_read ────────────────────────────────────►│
     │                                                                │
     │  ◄── 302 to /auth/meta/callback?code=…                         │
     │                                  │                             │
     │ ────────────────────────────────►│                             │
     │                                  │  POST oauth/access_token    │
     │                                  │ ──────────────────────────► │
     │                                  │  ◄── short-lived token      │
     │                                  │                             │
     │                                  │  GET fb_exchange_token      │
     │                                  │ ──────────────────────────► │
     │                                  │  ◄── 60-day token           │
     │                                  │                             │
     │  ◄── 302 back to Claude          │                             │
```

### Caching strategy

Meta Insights queries can be expensive and slow. The cache layer keys on a deterministic hash of `(tenant_id, level, fields, breakdowns, date_range)` and stores the response with a configurable TTL.

A second tier caches *yesterday and earlier* responses indefinitely (since historical Meta data does not change), with a daily reconciliation job to handle late-arriving conversion data.

### Database schema (sketch)

```sql
CREATE TABLE tenants (
  id           UUID PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE oauth_clients (
  client_id     TEXT PRIMARY KEY,
  client_secret TEXT NOT NULL,
  redirect_uris TEXT[] NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  access_token  TEXT PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  client_id     TEXT NOT NULL REFERENCES oauth_clients(client_id),
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE meta_tokens (
  tenant_id            UUID PRIMARY KEY REFERENCES tenants(id),
  encrypted_token      BYTEA NOT NULL,
  expires_at           TIMESTAMPTZ NOT NULL,
  scopes               TEXT[] NOT NULL
);

CREATE TABLE insights_cache (
  cache_key   TEXT PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  payload     JSONB NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL
);
```

### Failure modes (planned)

| Failure | Behaviour |
|---|---|
| Meta token expired | Auto-refresh with `fb_exchange_token`. If refresh fails, return a tool error asking the user to re-authorize. |
| Meta API rate limit | Exponential backoff with jitter. After 3 retries, surface a tool error with the `X-Business-Use-Case-Usage` header content. |
| Postgres unavailable | `/health` returns 503. New tool calls fail fast with a clear error. |
| Encryption key rotation | Stored encrypted token records carry a `key_version` byte. Rotation is non-destructive. |
