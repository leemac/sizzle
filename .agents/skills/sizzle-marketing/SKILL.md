---
name: sizzle-marketing
description: Create evidence-based Sizzle landing-page updates, real app screenshots, release stories, and launch drafts for a solo open-source maintainer. Use for Sizzle marketing work, not app feature implementation or publishing without authorization.
---

# Sizzle marketing

Make a useful app workflow visible, then write the smallest story that explains why a home cook would care. Favor a small, reusable batch of material over an ongoing content schedule.

## Product and voice

Read the checkout's `AGENTS.md`, `README.md`, and relevant UI before making product claims. Sizzle is a self-hosted cookbook: save a recipe page, keep ingredients and method, find something to cook, remember the keepers. Address home cooks who are comfortable running a home server, NAS, or private-network app.

- Lead with cooking and recipe ownership. Support it with real UI rather than stack details.
- Structured recipe imports and manual recipes work without AI. Claude is optional, uses the owner's key, and costs money per extraction. Verify the current implementation before describing its scope.
- YouTube support reads descriptions and linked recipe pages; it does not transcribe audio.
- Retain the early-development notice. Verify login and network-exposure guidance in the current README. Never imply public hosting is safe by default, everything works offline, all sites import, or extraction is perfect.
- No invented adoption numbers, testimonials, benchmarks, comparisons, or roadmap promises. Describe previews as previews.
- Use Sizzle's existing fonts and porcelain, ink, graphite, hairline, and yolk tokens. Use sentence case and plain verbs: save, find, cook, favorite.

## Turn a change into marketing

Start with a concrete user action and observable result: “Tap ingredients as you add them; keep your place while cooking.” Confirm that behavior in source or a local demo. For a narrow request, make the requested asset only.

For an open-ended refresh, connect the story across saving, browsing, cooking, and remembering. Give each section a distinct screenshot and purpose. Lead with varied food: mains, breakfast, baking, salads. Drinks can add variety; they should not dominate the first screen. Use one whole-app view for context and close crops for controls and details. Preserve existing URLs and unrelated app navigation.

For screenshots, read [references/screenshots.md](references/screenshots.md). The capture helper is `scripts/capture.mjs`; run it from the Sizzle checkout. The script uses installed Playwright, allows only loopback origins, blocks external browser requests, and never submits imports. It captures actual controls and uses ingredient/step clicks that stay in browser state. It does not create favorites or cooking history; prepare those only in a disposable demo database.

Treat screenshots as evidence. A static image of a control is not interactive. Keep image captions precise; label example data. Never generate an AI image and present it as an app screenshot. Give meaningful alt text, appropriate crops, lazy loading below the fold, and intrinsic image dimensions. When adding motion, use short, single-run reveals and small hover movement. Honor reduced motion and keep content readable if JavaScript fails.

For a release or launch batch, use [references/solo-dev-kit.md](references/solo-dev-kit.md) for reusable prompts, positioning angles, a draft structure, and a small measurement loop. Reuse one verified feature story across the site, release notes, and community draft. Posting, emailing, spending money, or deploying requires that action to be within the user's request; creating drafts does not authorize distribution.

## Finish

Check the changed page at 390px and 1280px: no horizontal overflow, readable crops, images loaded, visible keyboard focus, working links and theme controls, reduced motion, and no console errors. Inspect screenshots visually. Run relevant existing checks; run `bin/ci` and the Sizzle pre-PR review before opening a PR as required by the repo.

Return the preview URL, changed assets, useful next invocation, and exact verification limits. Distinguish local previews, drafts, and live publication.
