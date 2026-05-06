# Contributing

Thanks for considering a contribution. This project is small and aims to stay small — one focused, well-documented MCP connector.

## Before you open a PR

- For non-trivial changes, open an issue first so we can align on scope.
- New tools should be **read-only** unless there's a strong reason. The connector deliberately avoids campaign mutation tools to keep the threat model small.
- Match the existing code style (TypeScript strict, ES modules, no semicolons missed, 2-space indent).

## Local development

```bash
git clone https://github.com/maxx3250/claude-meta-mcp.git
cd claude-meta-mcp
npm install
cp .env.example .env
# fill in META_ACCESS_TOKEN and AUTH_TOKEN
npm run dev   # tsx watch mode
```

## Testing locally with Claude Desktop

Until v0.2 ships proper OAuth, the easiest way to call the local server from Claude Desktop is to add a stub stdio bridge. For now, smoke testing is done with `curl` — see `docs/DEPLOYMENT.md` step 6.

## Code review checklist

- [ ] No new dependencies unless really needed
- [ ] Tool inputs validated with Zod schemas
- [ ] Graph API calls go through `MetaClient`, not raw axios
- [ ] Errors propagate as `MetaApiError` (Graph errors) or generic `Error` (everything else)
- [ ] README / CHANGELOG updated if user-visible behaviour changes

## Reporting security issues

Email `security@markusstoeger.com` — please do not open public issues for security problems.
