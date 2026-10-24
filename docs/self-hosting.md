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

Database migrations run automatically on start.

## Back up

Back up the `sizzle-storage` volume. To copy it to a tarball:

```sh
docker run --rm -v sizzle_sizzle-storage:/data -v "$PWD":/backup alpine \
  tar czf /backup/sizzle-backup.tgz -C /data .
```

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
