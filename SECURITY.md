# Security Policy

## Supported versions

Until v1.0, only the latest minor release is supported with security fixes.

| Version | Supported |
|---------|-----------|
| 0.2.x   | yes       |
| < 0.2   | no        |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Preferred channel:

1. **GitHub Private Vulnerability Reporting** — open a private advisory at
   <https://github.com/maxx3250/claude-meta-mcp/security/advisories/new>

Alternative channel:

2. Email **security@markusstoeger.com** with a description and, if possible,
   a minimal reproduction. PGP is not required.

## What to include

- A description of the issue and its impact
- Steps to reproduce (or a proof of concept)
- The affected version / commit
- Whether the issue is already public anywhere

## Response timeline

- **Acknowledgement** within 48 hours
- **Initial assessment** within 7 days
- **Fix or status update** within 14 days

If the report is valid, a fix is published as a patch release and a GitHub
Security Advisory with a CVE (where applicable) is opened. Reporters are
credited in the advisory unless they request otherwise.

## Scope

In scope:

- The `claude-meta-mcp` Node service in this repository
- The example deployment guidance under `docs/`

Out of scope:

- Self-inflicted issues such as leaking your `AUTH_TOKEN` or
  `META_ACCESS_TOKEN` (rotate them, see the README)
- Vulnerabilities in upstream dependencies (please report those upstream)
- Denial of service via resource exhaustion against your own deployment
- The reference OAuth shim, which lives in a separate repository

## Hardening checklist for operators

These are not vulnerabilities in this project, but operators should:

- Always run behind HTTPS with a valid certificate
- Rotate `AUTH_TOKEN` and `META_ACCESS_TOKEN` periodically
- Restrict who can reach the connector (firewall, VPN, or htpasswd in front
  of the OAuth shim)
- Keep `META_ACCESS_TOKEN` out of logs and version control
