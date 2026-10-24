# Self-hosting Sizzle

## Requirements

- A machine that runs Docker: a home server, NAS, Raspberry Pi 4/5, or VPS. Sizzle idles at
  around 150 MB of RAM.
- An [Anthropic API key](https://console.anthropic.com/settings/keys) for importing recipes.

## Install

```sh
git clone https://github.com/leemac/sizzle.git && cd sizzle
cp .env.example .env
# edit .env: set ANTHROPIC_API_KEY and SIZZLE_API_TOKEN (openssl rand -hex 32)
docker compose up -d
```

Sizzle listens on port 3000 (change it with `SIZZLE_PORT`). Everything it stores lives in the
`sizzle-storage` Docker volume: SQLite databases, recipe photos, and a generated secret key.

## Upgrade

```sh
git pull && docker compose up -d --build
```

Database migrations run automatically on start. Back up before upgrading. If an older install
already contains duplicate recipe source URLs, the new unique index will refuse the migration
rather than delete recipes. Resolve those duplicate entries in the old version before upgrading.

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
