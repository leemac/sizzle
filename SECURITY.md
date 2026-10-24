# Security

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Report them privately through
[GitHub's private vulnerability reporting](https://github.com/leemac/sizzle/security/advisories/new).
If you can't use that form, email [sizzle@mckinnon.dev](mailto:sizzle@mckinnon.dev) instead.
You'll get an acknowledgement within a few days. Once a fix ships, we'll credit you in the advisory
unless you'd rather we didn't.

Only the latest release is supported.

## Threat model

Sizzle is a single-user, self-hosted app with **no login yet**. It's built to run on a home
network or a private network such as Tailscale or WireGuard. Anyone who can reach it can read,
add and delete recipes. So:

- **Don't expose Sizzle to the public internet as-is.** If you must, put an authenticating
  reverse proxy in front of it (e.g. Caddy with `basic_auth`, Authelia, Cloudflare Access) and
  set `SIZZLE_API_TOKEN`.
- Set `SIZZLE_API_TOKEN` anyway. It's cheap protection for the share API.

What Sizzle does defend against, because it processes content from the open web and email:

| Risk | Defence |
|------|---------|
| **SSRF**: a shared link (or a redirect, or a DNS answer) that points at your router, NAS, or cloud metadata service | `SafeHttp` allows only http/https on ports 80/443, resolves every hostname and rejects private, loopback, link-local and CGNAT addresses, pins the connection to the vetted IP (defeating DNS rebinding), and re-checks every redirect. Private-network fetches are off unless you set `SIZZLE_ALLOW_PRIVATE_NETWORK_FETCH=true`. |
| **Prompt injection** from hostile pages | The extraction call gives Claude no tools and constrains output to a JSON schema. Page content is labelled as untrusted data. Model output is validated: enums are enforced, and images can only be chosen from candidates the scraper found. |
| **Stored XSS** from imported content | Imported content is stored and rendered as plain text. React escapes everything; there is no HTML rendering of imports. A strict Content-Security-Policy (`default-src 'self'`) backs this up. |
| **Malicious images** | Downloads are size-capped, checked against image magic bytes, decoded with libvips under `VIPS_BLOCK_UNTRUSTED=1`, and re-encoded to WebP, which also strips metadata. |
| **Cross-site requests from your own browser** (CSRF) | The UI uses Rails CSRF tokens. The share API accepts only `application/json`, which browsers can't send cross-site without a CORS preflight that Sizzle never approves. |
| **DNS rebinding** against the UI | Rails host authorization answers only to IP addresses, bare hostnames, private suffixes (`.local`, `.lan`, `.home.arpa`, `.ts.net`, …) and anything listed in `SIZZLE_HOSTS`. |
| **Abuse of the import endpoint** | Rate limited, and imports cost you Claude credits, so `SIZZLE_API_TOKEN` is strongly recommended. |
| **Container escape and tampering** | The image runs as a non-root user. The compose file sets a read-only root filesystem and `no-new-privileges`. |

## For contributors and agents

The rules in [AGENTS.md](AGENTS.md#security-rules-non-negotiable) are mandatory for every change.
CI runs Brakeman, bundler-audit, npm audit and CodeQL on every pull request. Dependabot keeps
dependencies and pinned GitHub Actions current.
