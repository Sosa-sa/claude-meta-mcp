# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-05-06

Added Facebook Pages support and switched the recommended token type to System User tokens.

### Added
- 5 new tools for Facebook Pages:
  - `list_pages` (read) — Pages the authenticated System User manages
  - `list_page_posts` (read) — recent posts on a Page
  - `get_page_insights` (read) — Page-level metrics with 2026-valid metric names
  - `create_page_post` (**write**) — publish a new post (text + optional link)
  - `delete_page_post` (**destructive**) — remove a post from a Page
- `MetaClient.post()` and `MetaClient.delete()` for write operations
- `MetaClient.getPageAccessToken()` helper — Page tokens are needed for any Page-scoped write

### Changed
- README + setup docs now recommend Meta System User tokens (never expire) over user access tokens (60-day rotation)
- v0.2 still single-tenant — same `META_ACCESS_TOKEN` + `AUTH_TOKEN` model as v0.1
- Connector is no longer fully read-only. Two write tools require `pages_manage_posts` scope; if you only want read access, remove that scope from the System User and the write tools will fail with 403

### Notes
- `read_insights`, `pages_manage_metadata`, `pages_read_user_content` are *not* required by the current toolset. The 2026 Page Insights metric names changed: `page_impressions` and `page_fans` were deprecated. New defaults: `page_impressions_unique`, `page_post_engagements`, `page_follows`, `page_views_total`.

## [0.1.0] — 2026-05-05

Initial single-tenant alpha release.

### Added
- MCP Streamable HTTP server at `POST /mcp`
- Liveness probe at `GET /health`
- Bearer token auth middleware (single shared secret via `AUTH_TOKEN`)
- Meta Graph API client (axios, v22.0) with pagination helper and structured error wrapping
- 8 read-only tools:
  - `list_ad_accounts`, `get_ad_account`
  - `list_campaigns`, `get_campaign`
  - `list_adsets`, `list_ads`
  - `get_insights` (account / campaign / ad set / ad level, date presets + custom ranges + breakdowns)
  - `list_creatives`
- pm2 example config (`ecosystem.config.cjs`)
- Documentation: `README.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/META_APP_SETUP.md`

### Known limitations
- Single-tenant only — one Meta token, one shared bearer secret.
- No OAuth flow on either side. v0.2 will add OAuth 2.1 + DCR for the Claude side; v0.3 will add Meta OAuth user flow.
- No persistence layer. The Meta token must be refreshed manually every ~60 days.
- No caching. Every tool call hits Graph API directly.
