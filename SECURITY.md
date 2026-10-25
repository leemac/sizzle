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

### Optional shortcut pairing

`SIZZLE_SHORTCUT_PAIRING=true` enables installing and connecting a prebuilt iPhone shortcut.
It is off by default. Like the recipe UI, pairing and disconnecting are available to anyone
who can reach the web UI; keep it on your trusted network or behind authentication.
Creating a connection requires a CSRF-protected POST. Its random pairing code expires after
five minutes and can be redeemed only once, through a JSON-only, rate-limited endpoint.
The returned credential can only submit imports through `/api/shortcut_imports`; it cannot
read imports, change recipes, or use the existing token-protected script API. Only digests
are stored on the server. Disconnecting immediately invalidates the credential. Switching
the feature off disables pairing and device imports, including existing connections.

The distributed shortcut contains no credentials. Pairing happens after installation; the
shortcut saves its connection in `Shortcuts/sizzle-connection.json` in iCloud Drive. Treat
that file as a credential: it can sync to other devices on the same Apple account. Apple
may ask permission to use Files and contact the server. Use HTTPS or a trusted private
network for pairing and imports. An authenticating reverse proxy must also permit the
shortcut's requests; pairing does not bypass proxy authentication.

What Sizzle does defend against, because it processes content from the open web and email:

| Risk | Defence |
|------|---------|
| **SSRF**: a shared link (or a redirect, or a DNS answer) that points at your router, NAS, or cloud metadata service | `SafeHttp` allows only http/https on ports 80/443, resolves every hostname and rejects private, loopback, link-local and CGNAT addresses, pins the connection to the vetted IP (defeating DNS rebinding), ignores proxy environment variables (a proxy would re-resolve the hostname), and re-checks every redirect. A 30-second monotonic deadline covers DNS, headers, reads and redirects. Private-network fetches are off unless you set `SIZZLE_ALLOW_PRIVATE_NETWORK_FETCH=true`. |
| **Prompt injection** from hostile pages | The extraction call gives Claude no tools and constrains output to a JSON schema. Page content is labelled as untrusted data. Model output is validated: enums are enforced, and images can only be chosen from candidates the scraper found. |
| **Stored XSS** from imported content | Imported content is stored and rendered as plain text. React escapes everything; there is no HTML rendering of imports. A strict Content-Security-Policy (`default-src 'self'`) backs this up. |
| **Malicious images** | Downloads are capped at 15 MB and checked against image magic bytes. Images exceeding 16,000 pixels on either edge or 40 million total pixels are rejected before resizing. libvips runs under `VIPS_BLOCK_UNTRUSTED=1` in every runtime. Accepted images are re-encoded to WebP, stripping metadata; browser upload routes are disabled. |
| **Uploaded screenshots** | Write a recipe can send screenshots to Claude to fill in its fields, only when `ANTHROPIC_API_KEY` is set. Up to 4 per request (a larger request body is refused before it's parsed), each capped at 5 MB and accepted only if its magic bytes are PNG, JPEG, WebP or GIF (the browser's content type is ignored). They are sent to Claude and discarded: never stored, decoded or resized by Sizzle. Claude's answer goes through the same validation as any extraction and only fills in the form; nothing is saved until you press Save. The endpoint is CSRF-protected, rate limited and charges the import budget. |
| **Cross-site requests from your own browser** (CSRF) | The UI uses Rails CSRF tokens. The share API accepts only `application/json`, which browsers can't send cross-site without a CORS preflight that Sizzle never approves. |
| **DNS rebinding** against the UI | Rails host authorization answers only to IP addresses, bare hostnames, private suffixes (`.local`, `.lan`, `.home.arpa`, `.ts.net`, …) and anything listed in `SIZZLE_HOSTS`. |
| **Abuse of the import endpoint** | Rate limited, and imports cost you Claude credits, so `SIZZLE_API_TOKEN` is strongly recommended. |
| **Changing someone else's theme** | Each browser's theme choice is a cookie that only accepts known themes. The theme editor, which writes themes everyone shares, is off unless you set `SIZZLE_THEME_EDITOR=true`; with no login, anyone who can reach Sizzle can then change them. Theme colours must be `#rrggbb` before they reach the page's stylesheet, and edits are CSRF-protected, rate limited and capped at 50 themes. |
| **Container escape and tampering** | The image runs as a non-root user. The compose file sets a read-only root filesystem and `no-new-privileges`. |

## For contributors and agents

The rules in [AGENTS.md](AGENTS.md#security-rules-non-negotiable) are mandatory for every change.
CI runs Brakeman, bundler-audit, npm audit and CodeQL on every pull request. Dependabot keeps
dependencies and pinned GitHub Actions current.
