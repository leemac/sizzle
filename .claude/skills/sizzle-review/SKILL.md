---
name: sizzle-review
description: Pre-PR review of a Sizzle branch for the trust mistakes lint can't catch — data from pages, email or Claude used without validation, unsafe URLs, writes on GET, serializer/type drift, missing security tests. Use before opening a pull request, after bin/ci passes, or when asked to review a Sizzle diff.
---

# Sizzle pre-PR review

`bin/ci` already enforces the mechanical rules: RuboCop's `Sizzle/UntrustedFetch` and
`Sizzle/ShellString`, `Rails/OutputSafety`, and oxlint's `react/no-danger`. This review covers what
those can't see: **where a value came from, and whether it was checked before it was trusted.**

## How to run it

1. Get the diff against where the branch started: `git diff $(git merge-base origin/main HEAD)`.
   (Local `main` can be stale; use `origin/main`.)
2. Work through every check below against that diff. Read the surrounding code, not just the hunks.
3. Fix what you find on the branch, with a test for each fix. Anything you decide not to fix goes
   in the PR description with the reason.
4. Report: one line per check — "ok", or what you found and what you did.

## Checks

### 1. Every new value: where did it come from?

For each value the diff stores, renders, fetches, or compares, trace it back to its source. Treat it
as hostile if it came from a fetched page (HTML, meta tags, JSON-LD, canonical links, image URLs),
an email, Claude's output, or request params.

A hostile value must be checked **where it enters**, not where it's used:

- Page data → validated in `PageScraper`. Pattern: `trusted_canonical_url` only accepts an http(s)
  canonical on the host that was fetched, because the page chooses its own canonical link.
- Claude output → validated in `RecipeDraft`: type-checked, enums enforced, strings truncated,
  lists capped, image ids mapped only to scraped candidates. A new extracted field gets the same
  treatment there, never a raw `data["field"]` read in the pipeline.
- Request params → strong params or an explicit allowlist (see `Recipe::Filterable::FILTER_KEYS`).

Ask specifically: could a hostile page make this value point at *another* record or site (dedupe
keys, source URLs, ids)? Could it be long enough to fail a validation and turn into a generic error?

### 2. URLs reaching a sink

Any URL that reaches an `href`, `src`, a fetch, libvips, or a command must be http(s) and, for
fetches, go through `SafeHttp`. `Recipe#source_url_is_http` is the backstop for stored links; new
URL columns need the same validation.

### 3. GET requests stay read-only

No `GET` action or polled prop may write to the database, enqueue jobs, or call Claude. Background
maintenance goes in a job scheduled in `config/recurring.yml` (pattern: `ReconcileImportsJob`).
Polled pages (`usePoll`) hit their controller every few seconds; keep those actions cheap.

### 4. Serializers and TypeScript types match

If anything in `app/serializers/` changed, `app/frontend/types/index.ts` must change to match: same
keys, same nullability. Check that the page components using the type still handle `null`.

### 5. Security behaviour has a test that would fail without it

For each guard the diff adds or changes, there is a test that feeds it the hostile input and fails
if the guard is removed. Patterns: `page_scraper_test.rb` (hostile canonical links),
`recipe_draft_test.rb` (hostile model output), `import_pipeline_test.rb` (a page claiming another
site's recipe), `safe_http_test.rb` (SSRF). Tests use WebMock, `FakeResolver` and
`FakeExtractor` — never the network.

### 6. Settings and exposure

A new ENV setting lives in `lib/sizzle.rb`, defaults to the safe option, and is documented in
`.env.example`. Anything that widens exposure — a new public route, upload type, or private-network
fetch — is opt-in and called out in the PR's security checklist.
