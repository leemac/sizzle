# Self-hosting Sizzle

## Requirements

- A machine that runs Docker with Compose: a home server, NAS, Raspberry Pi 4/5 (64-bit OS),
  or VPS. Images are published for `amd64` and `arm64`. Sizzle idles at around 150 MB of RAM.
- Optional: an [Anthropic API key](https://console.anthropic.com/settings/keys) for pages without
  usable recipe data and for unstructured pasted text.

## Install

No clone or build needed. Download the compose file and settings from the latest release:

```sh
mkdir sizzle && cd sizzle
curl -fsSLO https://github.com/leemac/sizzle/releases/latest/download/docker-compose.yml
curl -fsSL https://github.com/leemac/sizzle/releases/latest/download/env.example -o .env
# edit .env: set SIZZLE_API_TOKEN (openssl rand -hex 32), and ANTHROPIC_API_KEY if you want AI
docker compose up -d
```

Sizzle listens on port 3000 (change it with `SIZZLE_PORT`). Everything it stores lives in the
`sizzle-storage` Docker volume: SQLite databases, recipe photos, and a generated secret key.
The footer in Sizzle shows which version you're running.

## Versions

Each release is published to `ghcr.io/leemac/sizzle` with these tags:

| Tag | Follows |
|-----|---------|
| `latest` | newest stable release (the default) |
| `0.0` | patch releases of 0.0 only |
| `0.0.1` | exactly that release; never changes |

Set `SIZZLE_VERSION` in `.env` to pin one of them. Until 1.0, a minor release (0.1 → 0.2) may
include breaking changes; the [release notes](https://github.com/leemac/sizzle/releases) say
what to do.

To check an image was built by this repository's release workflow:

```sh
gh attestation verify oci://ghcr.io/leemac/sizzle:latest -R leemac/sizzle
```

## Upgrade

Back up first (see below), then:

```sh
docker compose pull && docker compose up -d
```

Database migrations run automatically on start. A migrated database can't be opened by an
older version, so to roll back, restore the backup you made before upgrading and set
`SIZZLE_VERSION` to the version you came from. If an older install already contains duplicate
recipe source URLs, the new unique index will refuse the migration rather than delete recipes.
Resolve those duplicate entries in the old version before upgrading.

Read the release notes before upgrading across a minor version. A new release may also ship an
updated `docker-compose.yml` or new settings in `env.example`; both are attached to every release.

## Build from source

To run your own changes, clone the repository and build the image locally:

```sh
git clone https://github.com/leemac/sizzle.git && cd sizzle
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

The footer will show the version as `dev`.

## Back up

Stop Sizzle first so Rails, import workers, the cache and the queue cannot change SQLite
or its WAL files while they are copied. Confirm the volume name with `docker volume ls`
(the default Compose project uses `sizzle_sizzle-storage`). Keep backups private: they
contain your recipes, queued import text and the generated secret key.

From your Sizzle directory:

```sh
docker compose stop
docker run --rm -v sizzle_sizzle-storage:/data:ro -v "$PWD":/backup alpine \
  tar czf /backup/sizzle-backup.tgz -C /data .
docker compose start
```

If archiving fails, keep any previous backup and restart Sizzle with `docker compose start`.

### Verify a restore

Before relying on a backup, restore it into a **new** volume while leaving your live data alone:

```sh
docker volume create sizzle-restore-check
docker run --rm -v sizzle-restore-check:/data -v "$PWD":/backup:ro alpine \
  tar xzf /backup/sizzle-backup.tgz -C /data
```

Check each restored database using the built application image (each command must print `ok`):

```sh
docker run --rm --entrypoint sqlite3 -v sizzle-restore-check:/data \
  "$(docker compose images -q sizzle)" /data/production.sqlite3 'PRAGMA quick_check;'
docker run --rm --entrypoint sqlite3 -v sizzle-restore-check:/data \
  "$(docker compose images -q sizzle)" /data/production_cache.sqlite3 'PRAGMA quick_check;'
docker run --rm --entrypoint sqlite3 -v sizzle-restore-check:/data \
  "$(docker compose images -q sizzle)" /data/production_queue.sqlite3 'PRAGMA quick_check;'
```

Then boot the restored copy on a separate local port, without your API credentials:

```sh
docker run -d --name sizzle-restore-check -p 127.0.0.1:3001:80 --read-only \
  --tmpfs /rails/tmp:uid=1000,gid=1000,mode=0755 --tmpfs /tmp:mode=1777 \
  --security-opt no-new-privileges:true -v sizzle-restore-check:/rails/storage \
  "$(docker compose images -q sizzle)"
```

Open `http://localhost:3001`, confirm expected recipes are present and their photos open,
then stop the test container with `docker stop sizzle-restore-check`. Use a fresh volume
and container name for each verification. For a real recovery, stop Sizzle and point its
storage mount at the verified restored volume before starting it again.

## Reaching Sizzle from your phone

Sizzle has no login yet, so keep it off the public internet. Two good options:

**Home network only.** Use `http://<server-ip>:3000`. Sharing works while you're on your Wi-Fi.

**Tailscale (recommended).** Install Tailscale on the server and your phone. Sizzle then works
from anywhere at `http://<server-name>:3000`. For HTTPS, which iOS prefers and which features
like keeping the screen awake in cook mode need, let Tailscale terminate TLS:

```sh
tailscale serve --bg 3000
```

Your app is now at `https://<server-name>.<tailnet>.ts.net`. Set `SIZZLE_ASSUME_SSL=true` in
`.env` and restart.

## Behind a reverse proxy

If you put Sizzle behind Caddy, Traefik or nginx with TLS, set `SIZZLE_ASSUME_SSL=true`,
`SIZZLE_FORCE_SSL=true`, and add your hostname to `SIZZLE_HOSTS`. If the proxy makes Sizzle
reachable from the internet, put authentication in front of it (see [SECURITY.md](../SECURITY.md)).

## The iPhone Shortcut

Open **Share from your phone** in Sizzle. It shows the exact URL to use and walks through
building the Shortcut in the Shortcuts app.

For the prebuilt shortcut, set `SIZZLE_SHORTCUT_PAIRING=true` and restart Sizzle. Open
**Share from your phone** on your iPhone using the server's home-network or Tailscale address,
tap **Add “Save to Sizzle”**, then return and choose **Connect shortcut**. Open the connection
link within five minutes and approve the connection in Shortcuts. You do not need to copy
`SIZZLE_API_TOKEN`. The original token-protected API remains available for scripts.

Connected shortcuts appear on the sharing page; **Disconnect** immediately revokes one.
Pairing is available to anyone who can use the web UI, so keep Sizzle on your trusted network
or behind authentication. See [shortcut pairing security](../SECURITY.md#optional-shortcut-pairing).
An authenticating reverse proxy may require additional setup for Shortcuts.

The shortcut stores its connection in `Shortcuts/sizzle-connection.json` in iCloud Drive.
It connects to one cookbook per Apple account; reconnecting replaces that file. Do not share
the connection file. Shortcuts may ask permission to use Files and contact your server.
“Sent to Sizzle” means the server accepted the request, not that extraction has finished.

Maintainers can rebuild the credential-free template on a Mac with `bin/build-shortcut`.
Apple signs the static file for distribution; no user's connection or API token is embedded.
The signed asset is bundled with Sizzle, so self-hosted servers do not need macOS or signing tools.
