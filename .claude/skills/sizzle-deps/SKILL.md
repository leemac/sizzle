---
name: sizzle-deps
description: Work through Sizzle's open Dependabot pull requests and dependency security failures — decide what's safe, unblock CI when bundler-audit, npm audit or Brakeman fail every PR at once, handle Ruby, Node and base-image bumps, and hand the maintainer a merge list. Use when asked about Dependabot, dependency updates, "why is CI red on every PR", or a gem/npm advisory.
---

# Sizzle dependencies

Dependabot (`.github/dependabot.yml`) opens weekly PRs for bundler (Rails grouped), npm (minor and
patch grouped as `frontend`), GitHub Actions (CodeQL grouped) and Docker `FROM` lines. Agents
review and fix; **only the maintainer merges**. Never push to `main`, and never change CI unless
the maintainer asks.

## 1. Survey

```sh
gh pr list --author app/dependabot --json number,title,statusCheckRollup,mergeable \
  --jq '.[] | "#\(.number) \(.mergeable) \(.title)"'
gh pr checks <n>   # for each red one
```

Sort every PR into one of these:

- **Green, patch or minor, runtime or dev**: read the changelog (`gh pr view <n>`, Dependabot
  includes release notes), then "ready to merge".
- **Red for its own reasons**: the update broke something. Fix it on the PR's branch (step 3).
- **Red for a shared reason**: the same security step fails on several PRs, including ones that
  don't touch that ecosystem. `main` is the problem, not the PR. Fix `main` first (step 2).
- **Major version**: read the upgrade guide. Treat as a normal change: its own branch, its own
  tests, its own PR if the Dependabot one can't be fixed in place.
- **Ruby, Node or base image**: follow "Maintain Ruby and the container base" in
  `docs/releasing.md`. A Ruby bump must update `.ruby-version`, the Dockerfile `FROM` (digest from
  the multi-platform index: `docker buildx imagetools inspect`) and `Gemfile.lock` together; a Node
  major must update `.node-version` with the Dockerfile.

## 2. When every PR is red: fix main

These steps pull fresh advisory data, so they start failing on `main` without any code change:

- `bin/bundler-audit check --update`: a gem on `main` has a new advisory.
  `bundle update --conservative <gem>` to the fixed patch release. Don't touch `Gemfile`.
- `npm audit --audit-level=high --omit=dev`: same, with `npm update <pkg>` or an `overrides`
  entry if the fix is only in a transitive dependency. Say why in the PR.
- `bin/brakeman` runs with `--ensure-latest`: a new Brakeman release fails CI until it's bumped,
  and a new Brakeman may then warn about the Ruby version itself.

Branch `agent/deps-<short-slug>` from `origin/main`, make the smallest fix, run `bin/ci`, and open
one PR that says which Dependabot PRs it unblocks and which advisories it fixes (name, severity,
fixed version). That PR supersedes any Dependabot PR it covers; say so, and the maintainer closes
those. After it merges, Dependabot PRs need `@dependabot rebase` (ask before commenting) or a
merge of `main`.

## 3. Fixing a Dependabot PR in place

Check it out in a worktree (`gh pr checkout <n>` inside `git worktree add`), fix what the update
broke (type errors, renamed APIs, snapshot changes), run `bin/ci`, and push to the same branch
only with the maintainer's go-ahead. Keep the fix to what the update requires. If the update
widens exposure (a new network call, a changed sanitizer default, a parser change in
nokogiri/libvips) say so: it needs a `security` look and a test.

## 4. Things that always need a human

- Anything touching `SafeHttp`, image decoding (libvips, `image_processing`), HTML parsing
  (nokogiri, loofah) or the `anthropic` gem's request shape: read the changelog for behaviour
  changes, not just "tests pass".
- GitHub Actions bumps: confirm the action is pinned the same way as before (by version or SHA)
  and that CodeQL `init` and `analyze` stay on the same version.
- A dependency that's new rather than updated: AGENTS.md says to explain any new dependency.

## Report

A table the maintainer can work down: PR (full URL), what it updates, status (ready / fixed /
needs a human / close as superseded), and why. Then the merge order. Shared fixes go first, then
Ruby or base images, then everything else. Last, note which advisories will reach users only with
the next release, so it can go in the `sizzle-release` notes.
