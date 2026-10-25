---
name: sizzle-preview
description: Run Sizzle locally from a worktree with seed or real recipes, and take the 390px and 1280px screenshots a UI pull request needs. Use when asked to run, preview or screenshot the app, to show a change working, or to load someone's cookbook export for a local look.
---

# Run and preview Sizzle locally

Several agents often run Sizzle side by side in separate worktrees, so ports, databases and browser
test servers collide. Check before you start anything.

## Start the app

1. **Set up the worktree** with `bin/setup --skip-server`. It installs dependencies and creates the
   worktree's own `storage/development.sqlite3`. A brand-new database is seeded automatically with
   21 sample recipes.
2. **Pick free ports.** `bin/dev` runs Rails and Vite through foreman, and foreman gives the web
   process `PORT + 100`. List what's taken first:

   ```sh
   lsof -iTCP -sTCP:LISTEN -P | grep -E ':3[0-9]{3}\b'
   PORT=3700 VITE_RUBY_PORT=3336 bin/dev    # Rails on http://localhost:3800, Vite on 3336
   ```

   Pick another pair if those are taken. Start it in the background and wait until
   `curl -s -o /dev/null -w '%{http_code}' http://localhost:<rails port>/` returns 200 or 302.
3. Give the person the Rails URL and recipe links (`/recipes/<id>`), and tell them how to stop it.

Frontend edits hot-reload; Ruby changes need a restart. "Vite server connection lost" in the
console after `bin/setup` or a dependency install is the dev client reconnecting, not a bug.

## Real recipes

Sizzle can't restore its own exports yet. To preview with someone's cookbook, load it into the
worktree's dev database (never production, never the main checkout's database):

```sh
bin/rails runner .claude/skills/sizzle-preview/scripts/load_cookbook.rb path/to/cookbook.json
APPLY=1 bin/rails sizzle:reparse_ingredients   # structure older plain ingredient lines; omit APPLY for a dry run
```

The loader skips recipes whose title already exists and leaves out photos and history. An export is
the person's private data. Use it only locally: no screenshots of it in the repo, no fixtures built
from it, and nothing from it in PR text.

## Screenshots for a pull request

`AGENTS.md` asks for 390px and 1280px views of UI changes. Take them from **seed recipes**, because the
repo is public.

- Commit them as `docs/screenshots/<feature>-<width>.png` and link them in the PR body as
  `https://github.com/leemac/sizzle/blob/<branch>/docs/screenshots/<file>.png?raw=true`.
- The page header is sticky, so an element screenshot can catch it mid-image. Scroll the target to
  just below the header (`window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 80)`) and take
  a viewport shot instead.
- At 1280px the ingredients are a narrow sticky column, so an ingredient-list shot looks much like
  the 390px one. Say so in the PR rather than padding it out.
- With the Playwright MCP:
  - `file:` URLs are blocked; serve static files with `python3 -m http.server --bind 127.0.0.1 <port>`.
  - Screenshots and snapshots land in the main checkout's `.playwright-mcp/` (gitignored), which may
    also hold the person's own files. Delete only the files you created.

## Browser tests

`npm run test:browser` (and the last step of `bin/ci`) always starts its server on port **3211**.
If another worktree is using it, the step fails in under a second with "is already used".

- Wait until `lsof -iTCP:3211 -sTCP:LISTEN` is empty, then rerun.
- Reset the test database first with `RAILS_ENV=test bin/rails db:schema:load`. Leftover rows from
  an earlier run cause false failures.
- Inside the command sandbox, Chromium page loads fail; run browser tests outside it.
- To read an ingredient row as a person sees it, use its `innerText` with whitespace collapsed.
  Parsed lines render amount and item as separate columns, so `textContent` runs them together.
