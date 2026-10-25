# Real screenshots, repeatably

Run from a Sizzle checkout with its Ruby and Node dependencies, Playwright Chromium, and `cwebp` installed. Use the bundled, licensed seed photos; do not import third-party recipes or expose private cookbook contents for a marketing capture.

The light/dark pairs in `site/images` were captured from app revision `450836948943daa7ae9f1e6f5a60d313f6d3151f`, which follows the system appearance. Later app revisions force dark mode. To reproduce these pairs, serve that app revision in a separate disposable checkout and run the current capture helpers against it. Both helpers check the rendered palette before saving; do not override app CSS or label a dark capture as light. The marketing page's system preference is independent of the app's current default.

Create a separate database instead of altering the maintainer's cookbook:

```sh
mkdir -p tmp/marketing
DATABASE_URL=sqlite3:tmp/marketing/demo.sqlite3 bin/rails db:prepare
```

In development, `db:prepare` seeds a new database. If it is already initialized, `db:seed` adds missing samples. Check the current seed behavior before reusing an older database.

To place varied food first and demonstrate favorites/history in this disposable database:

```sh
DATABASE_URL=sqlite3:tmp/marketing/demo.sqlite3 bin/rails runner '
  samples = Recipe.where(source_name: "Sizzle sample kitchen")
  priority = ["Coconut vegetable korma", "Lemon salmon with cucumber salsa",
              "Smoky sweetcorn and black bean tacos", "Chocolate chunk cookies with flaky salt",
              "Blueberry buttermilk pancakes", "Rainbow chickpea salad with lemon tahini dressing"]
  food = samples.where.not(course: "drink").to_a.sort_by { |r| priority.index(r.title) || 100 + r.id }
  food.each_with_index { |r, i| r.update_columns(created_at: Time.current - i.minutes) }
  recipe = samples.find_by!(title: "Coconut vegetable korma")
  recipe.favorite!
  recipe.cooks.create!(cooked_at: Time.current) if recipe.cooks.none?
'
DATABASE_URL=sqlite3:tmp/marketing/demo.sqlite3 bin/rails server -b 127.0.0.1 -p 3212 -P tmp/pids/marketing-preview.pid
```

Use a free port if necessary. Do not print `.env` or setup screens containing a share token. Keep the app bound to loopback.

In another terminal, from the same checkout:

```sh
node .agents/skills/sizzle-marketing/scripts/capture.mjs http://localhost:3212 site/images
```

The helper expects the bundled Coconut vegetable korma sample. It captures `gallery`, `list`, `recipe`, `cooking`, `history`, and `import`, each at 390px and 1280px browser widths in both light and dark mode, with `deviceScaleFactor: 2` (24 views). Lossless PNG captures are encoded as lossless WebP: `gallery-1280@2x.webp`, for example, contains 2560 physical pixels across. Light captures retain their existing URLs; dark captures add `-dark` before `.webp`. The width in the filename is the browser width; crops can be smaller. Images wait for fonts and decoding. Inspect the output; an image loading successfully does not establish that the composition is useful.

For the layered seasonal hero, run `node .agents/skills/sizzle-marketing/scripts/capture-hero.mjs http://localhost:3212`. This captures nine bundled recipes in both modes as `hero-<dish>-390@2x.webp` and `hero-<dish>-390@2x-dark.webp`, including soup, ramen, salmon, berry tarts, banana bread and cookies. The page selects a Northern-hemisphere season by month; the four season choices also work without JavaScript. These are actual app views of sample recipes with licensed stock food photographs, not photographs of the exact recipes. Photo sources and licenses are in `db/seeds/README.md`.

The marketing page follows `prefers-color-scheme`. Use `<picture>` sources to select matching real app captures, including mobile crops. Keep the default theme demo on System; its Light and Dark choices affect only the demo. System colors and screenshot selection work without JavaScript and respond to live system changes.

Use the crop's CSS dimensions for the HTML width/height attributes. Keep at least two physical image pixels per rendered CSS pixel, including any crop that is stretched within a feature section. Lossless encoding preserves text edges; increasing JPEG quality or upscaling an existing capture does not replace a high-density capture. The page QA helper checks the rendered resolution at 2× density.

Use these assets deliberately:

| View             | Purpose                                       | Suggested placement         |
| ---------------- | --------------------------------------------- | --------------------------- |
| Recipe on phone  | Immediately show food and a real recipe       | Hero                        |
| Import form crop | Show multiple links and the manual option     | Saving section              |
| Gallery          | Show food variety and search/filter controls  | Collection overview; README |
| List             | Demonstrate compact browsing                  | Supporting close-up         |
| Cooking          | Show ingredient check-offs and step highlight | Cooking section             |
| History          | Explain the payoff of “I made this”           | Remembering section         |

Crop around the relevant controls rather than shrinking a whole long page. Show at least one complete row of recipe cards in the gallery. On phones, use a phone capture rather than scaling desktop text to an unreadable size. A close-up can show a portion of the page if the caption identifies it. Do not alter labels or invent controls.

When updating assets used at stable URLs, bump their cache query versions in `site/index.html`. The README uses `docs/images/cookbook.webp`, copied from the lossless desktop gallery capture. Keep the existing `docs/images/cookbook.jpg`, `site/images/cookbook.jpg` and `site/images/cookbook-phone.jpg` URLs available if replacing those files.

Serve the page with `python3 -m http.server 4174 --bind 127.0.0.1 --directory site`. Verify at both widths and save page review screenshots under `docs/screenshots/`. Leave a user-requested preview running for review; stop capture-only servers when finished unless the user also wants to explore the app.

For repeatable page QA after the server is running:

```sh
node .agents/skills/sizzle-marketing/scripts/check-page.mjs http://127.0.0.1:4174
```

This checks image decoding, matching light/dark screenshot sources, live system changes, horizontal overflow, keyboard focus, scroll reveals, reduced motion (including a live preference change), all theme/mode combinations, and content visibility with JavaScript disabled. It saves the full page and theme preview at both widths in both modes, adding `-dark` to the dark review filenames. It also verifies the complete hero fits laptop viewports. Run capture first, then QA; do not overwrite screenshots while the QA browser is reading them.
