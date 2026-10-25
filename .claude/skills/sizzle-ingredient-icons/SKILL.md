---
name: sizzle-ingredient-icons
description: Add, redraw or rematch Sizzle's ingredient icons — the hand-drawn stroke icons beside each ingredient and the keyword matcher that picks them. Use when an ingredient shows the wrong icon or none, when drawing a new icon, when changing keywords or groups, or when checking icon coverage against a cookbook export.
---

# Sizzle ingredient icons

Each ingredient row on the recipe page starts with a small icon chosen from the ingredient's name.
Everything lives in `app/frontend/lib/ingredientIcons.ts`:

- `INGREDIENT_ICONS`: one entry per icon, with its `group`, one SVG path `d`, and `keywords`.
- `INGREDIENT_GROUPS`: the kinds of ingredient, in the order the "By type" view lists them.
- `ingredientIcon(item)` picks an icon; `groupByType(items)` builds the "By type" view.

`IngredientIcon.tsx` draws the icon, or a quiet dot when nothing matches. Icons are drawn once by
hand and committed. Never generate them at runtime (model-made SVG is an injection risk and differs
every time), and never use emoji (they ignore the theme).

## Drawing an icon

- **Format:** one path on a 24×24 grid, stroked in `currentColor`, stroke width 1.8, round caps and
  joins (the same as `Icon.tsx`). No fills or colours of its own, so it follows every theme.
- **Bounds:** keep the drawing inside 2–22 on both axes. The stroke adds 0.9 on each side.
- **Shape:** aim for a recognisable silhouette that reads at **16px**. Use two or three interior
  details at most; anything finer turns to mush. Dots are `M x y h.01` (round caps draw them).
- **Look at it before committing.** Render a contact sheet and actually view the PNG:

  ```sh
  node --experimental-strip-types .claude/skills/sizzle-ingredient-icons/scripts/contact-sheet.mjs tmp/icons.svg garlic onion
  rsvg-convert tmp/icons.svg -o tmp/icons.png
  ```

  It shows each icon at 72, 20 and 16px with the keyline. Leave out the names to see the whole set.
- **Compare with its look-alikes.** Put the new icon beside the icons it could be confused with.
  Misses from past rounds:
  - tofu read as a cardboard box, and still looks a little like one
  - a banana drawn as a tapered pod read as the chilli; a crescent with a stem fixed it
  - a rolling pin with tick marks read as a skewer
  - a butternut squash read as a pear and was dropped
  - onion and garlic were too alike until the onion got rings and roots, and the garlic got cloves
  - a spice jar with bands read as a battery
- If a drawing still fails after two tries, say so in the PR and leave it for a person to judge.
  Don't ship a third guess.

## Matching

`ingredientIcon(item)` reads the name like this:

1. It drops text in brackets and anything after the first comma, since that's usually preparation or
   a note.
2. **The keyword that ends nearest the end of the name wins**, because the last word names the thing:
   chili garlic *sauce*, celery *salt*, cherry *tomatoes*. A longer keyword breaks ties, so
   "peanut butter" beats "butter".
3. If nothing matches, it tries the whole line ("neutral, high smoke point oil" → oil).
4. It matches whole words only, with an optional "s" or "es" plural, ignoring accents ("jalapeños").
   Write irregular plurals as their own keywords ("berries", "anchovies", "bay leaves").

When something matches wrongly:

- **Compound names:** add the longer phrase to the right icon. It ends in the same place and is
  longer, so it wins. Examples: "cayenne pepper" → spice (not salt and pepper), "garlic clove" →
  garlic (not the spice "clove"), "tomato paste" → tomato (not the paste jar).
- **Words that mean different foods:** don't use them as keywords. Bare "ribs" sent "celery ribs" to
  steak; use "short ribs" instead.
- **Notes in the name:** some older web imports keep the whole line in `item`. The bracket and comma
  rules handle most of it. Run `bin/rails sizzle:reparse_ingredients` (dry run; add `APPLY=1` to
  write) to structure old lines rather than adding keywords for junk.
- Leave the "no match" case alone: the dot is deliberate, and so is not having a catch-all icon.

## Groups

Every icon needs a `group` from `INGREDIENT_GROUPS` (produce, protein, dairy, seasoning, pantry,
liquid). Anything without an icon lands in "Other". New groups change the "By type" view and
need an issue first.

## Checking

- `npx vitest run app/frontend/lib/ingredientIcons.test.ts`. Add a case for every new rule or
  keyword fix, using the real line that went wrong. Two tests guard the whole set:
  - every icon must be plain path commands
  - every keyword on its own must map back to its icon, which catches keywords that steal each
    other's matches
- Coverage against real data:

  ```sh
  node --experimental-strip-types .claude/skills/sizzle-ingredient-icons/scripts/coverage.mjs path/to/cookbook.json --all
  ```

  It takes a cookbook export (Settings → Your data → Download cookbook; use `cookbook.json` from the
  archive) or a text file with one ingredient per line. Read every match with `--all`, not just the misses; wrong matches hide in the
  hits. The seed recipes are a fair baseline. Never commit someone's cookbook or copy whole recipes
  into fixtures.
- UI changes still follow `AGENTS.md`: screenshots at 390px and 1280px, `bin/ci`, then `/sizzle-review`.
  Use `sizzle-preview` to run the app with real recipes.

## Proposing a batch of new icons

For more than two or three icons, or a style change, show the person before opening a PR. Put the
drawings on a throwaway preview page with Keep, Tweak and Redo ratings and a JSON export, and include
their real ingredient lines in context. The personal `design-review-loop` skill describes the setup,
if it's installed.
