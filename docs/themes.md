# Themes

Every theme lives in [`config/themes.json`](../config/themes.json). Each one sets the same colour
roles for light and dark, and the app turns them into CSS variables at runtime, so a new theme needs
no code changes.

```json
{
  "id": "pesto",
  "name": "Pesto",
  "description": "Deep basil green. Calm, fresh and kind to food photos.",
  "light": { "porcelain": "#f4f5f1", "paper": "#ffffff", "...": "..." },
  "dark": { "porcelain": "#111613", "paper": "#19201b", "...": "..." }
}
```

## Roles

| Token | Used for |
|-------|----------|
| `porcelain` | Page background |
| `paper` | Cards, inputs and unselected chips |
| `ink` | Main text, focus rings |
| `graphite` | Secondary text |
| `hairline` | Borders and rings |
| `action`, `on-action` | The main button on a page, and its label |
| `active`, `on-active` | Selected filters, toggles that are on, done steps, and their labels |
| `mark` | The highlighter on checked ingredients and the active step |
| `accent` | The accent used as an icon on a card, like the favorite heart |
| `danger`, `on-danger` | Errors and destructive buttons, and their labels |

Name a component's colours by role (`bg-action text-on-action`), never by hue or hex.

## Making a theme in the app

Anyone using Sizzle can open Appearance, pick a theme and choose **Customize** to start a copy of
it in the theme editor. The editor has a colour picker and a hex box for every role in light and
dark, a live preview, and readability warnings for the same pairs the tests check. Saving switches
that browser to the new theme, and everyone else using the server can pick it too. Custom themes
can be edited or deleted later; anyone using a deleted one goes back to the default.

Custom themes are stored in the `custom_themes` table, not in `themes.json`, and are capped at 50
per server. Their colours go through the same `#rrggbb` checks as the built-in ones, because they
end up in the page's stylesheet. Readability warnings don't block saving: it's your cookbook.

## Adding or changing a built-in theme

1. Add an entry to `themes.json`. The `id` is lowercase letters, digits and dashes; it ends up in
   a cookie and an HTML attribute. Every token must be a `#rrggbb` colour, for both light and dark.
   Pick a fun food name and a one-line description.
2. Run `bin/rails test test/models/theme_test.rb`. It rejects malformed files, and it checks
   contrast: 4.5:1 for every text pair and 3:1 for `accent` on `paper`, in both modes.
3. Run `bin/rails themes:preview` to redraw the README graphic, and commit the two SVGs it writes
   to `docs/images/`. A test fails if they're out of date.

In development the app reloads when `themes.json` changes. Elsewhere, restart it.

## How a choice is stored

Sizzle has no accounts, so each browser keeps its own choice in two cookies, `sizzle_theme` and
`sizzle_mode` (`light`, `dark` or `auto`). The server only accepts ids from `themes.json` and those
three modes, and falls back to the default theme in dark for anything else. It sets
`data-theme` and `data-mode` on `<html>` before the page loads, so there's no flash of the wrong
theme.
