# Sizzle

**Every recipe you love, minus the life story.**

> **Very, very early in development.** Sizzle is experimental and unfinished. Expect rough edges
> and frequent changes. See the [roadmap](https://github.com/leemac/sizzle/issues).

Sizzle is a self-hosted cookbook. Share a recipe page from your phone, paste a link, or paste the
recipe text. Sizzle keeps the ingredients, the steps and the best photo, drops the ads and pop-ups,
and adds it to a fast, photo-first collection you can search and filter.

- **Share from anywhere.** One tap in your iPhone's share sheet sends a page to Sizzle.
- **No AI required.** Import recipe data from a website, or write a recipe yourself. Optional
  Claude extraction handles pages without usable recipe data and unstructured pasted text.
- **Yours.** Runs on your own server with SQLite, in one small container. No accounts, no tracking.
- **Browse.** Full-text search plus filters for course, cuisine, diet, main ingredient and time.

## Run it

You need Docker. No AI account or API key is required for manual entry or imports from a page
with usable recipe data. You can add an [Anthropic API key](https://console.anthropic.com/settings/keys)
later for other pages and unstructured pasted text; each AI extraction is a paid Claude request.

```sh
git clone https://github.com/leemac/sizzle.git && cd sizzle
cp .env.example .env        # set SIZZLE_API_TOKEN — see below
docker compose up -d
```

Open `http://<your-server>:3000`. Your recipes, photos and databases live in the
`sizzle-storage` volume, so back that up.

Choose **Setup** in Sizzle for a walkthrough of your cookbook and your first recipe. AI
configuration is optional; credentials stay in your server environment.

On **Add recipe**, choose **Import a link** to read a site's schema.org Recipe data, or **Write a
recipe** to enter a title, ingredients and method. If a page lacks usable recipe data, Sizzle uses
Claude only when an API key is configured; otherwise it explains how to add the recipe manually.

Then set up sharing from your phone: open **Share from your phone** in Sizzle for a two-minute
Shortcut walkthrough.

### Keep it private

Sizzle has no login yet. Run it on your home network or a private network like Tailscale, and set
`SIZZLE_API_TOKEN`. Read [SECURITY.md](SECURITY.md) before exposing it anywhere else.

### Configuration

Everything is set with environment variables. [.env.example](.env.example) lists them all with
explanations.

## Develop

```sh
bin/setup --seed   # Ruby 3.3, Node 22 and libvips required
bin/dev            # http://localhost:3000
npx playwright install chromium  # once, for browser regression tests
bin/ci             # all checks and tests
```

The architecture, conventions and security rules are in [AGENTS.md](AGENTS.md). It's written for
AI coding agents and humans alike: Sizzle is built in the open as a "software factory", where
well-specified issues are worked by agents and reviewed by people. See
[docs/factory.md](docs/factory.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[AGPL-3.0](LICENSE). You can run, modify and share Sizzle freely. If you offer a modified version
as a service, you must share your changes.

Bundled third-party assets keep their own licenses, including the Bricolage Grotesque font (SIL Open
Font License 1.1). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
