---
name: sizzle-release
description: Prepare and cut a Sizzle release — work out what changed since the last tag, choose the version, write the in-app release journal entry and the GitHub release notes, open the notes PR, then (after it merges and only with the maintainer's go-ahead) push the tag and watch the Release workflow. Use when asked to release, cut, tag or ship a version, or "what would a release include?".
---

# Sizzle release

`docs/releasing.md` is the source of truth; read it first. This skill is the checklist for
following it without missing a step. A release is public and permanent: a pushed version tag is
never moved or reused, and the image it builds reaches every self-hoster who tracks `latest`.

**Never push a tag, publish or edit a GitHub release without the maintainer saying so in this
conversation, for this version.** Preparing notes and opening the notes PR is fine.

## 1. Work out what's in it

Use `origin/main`, never a local `main` that may be stale.

```sh
git fetch origin --tags
prev=$(git describe --tags --abbrev=0 --match 'v[0-9]*' origin/main)
git log --oneline --merges "$prev"..origin/main
git diff --stat "$prev" origin/main -- db/migrate docker-compose.yml .env.example lib/sizzle.rb Dockerfile
```

Read every merged PR (`gh pr view <n> --json title,body`), not only the titles. Sort each into:

- **What's new**: behaviour a user can see. Group small UI changes into one line.
- **Security**: anything fixing an advisory, a CVE, or a hardening change. Name the component and
  versions; don't copy CVE IDs unless the PR verified them.
- **Fixes**: bugs a user could have hit.
- **Invisible**: CI, lint, dev tooling, tests, docs-only, build-only dependencies. These go only
  in the "Changes reviewed" link, not the notes.

Then answer the upgrade questions from the diff, not from memory:

- Migrations? List them by what they do. If any, rollback needs the pre-upgrade backup.
- New or changed settings in `lib/sizzle.rb` / `.env.example`? Give the default, and say whether
  it widens exposure (it must be off by default if so).
- Compose or Dockerfile changes that a self-hoster must act on?
- Does anything send data to a third party (Anthropic) that didn't before?

## 2. Choose the version

Follow "Versions" in `docs/releasing.md`. Before 1.0: new features or any breaking change →
minor; fixes only → patch. Pre-releases (`-rc.N`) never move `latest`. Confirm the number with
the maintainer if it isn't obvious.

## 3. Write the notes

Prepend an entry to `config/releases.json` (newest first) with `version` (no `v`), the intended
tag `date` (`YYYY-MM-DD`, the day you'll tag), and `sections`. Match the previous entries:

1. **About this release**: the standing "early in development" line. If the release has security
   fixes, say so and tell people to upgrade.
2. **What's new**, **Security**, **Fixes**: one sentence or two per item. Say what changes for
   the person using it, in plain words, using the button and page names they see. Opt-in features
   name their setting and its default, and say what leaves the server.
3. **Upgrade**: migrations, settings and Compose changes; the backup link
   (`docs/self-hosting.md#back-up`); "Pin SIZZLE_VERSION=x.y.z, then run docker compose pull and
   docker compose up -d"; and what rollback takes.
4. **Known limitations**: keep the "no login" line; add new limits honestly.

Plain text only (React escapes it). No editorial titles, summaries or commentary, and no claim you
didn't check in the code or the PR. Follow the `sizzle-copy` skill: no filler.

Also write the GitHub release body: the same sections as Markdown, each "What's new" line ending
with its PR link (`[#97](https://github.com/leemac/sizzle/pull/97)`), and a final line
`Changes reviewed: https://github.com/leemac/sizzle/compare/<prev>...<sha>`. Keep it in the notes
PR description so the maintainer reviews both together. The two must agree.

## 4. Open the notes PR

Branch `agent/release-x.y.z` from `origin/main`. Run:

```sh
bin/rails test test/models/release_notes_test.rb test/controllers/releases_controller_test.rb
npm test -- ReleaseNotesLink
bin/ci
```

Preview `/releases` at 390px and 1280px (the `sizzle-preview` skill), with the new entry expanded,
and check the unread dot clears after a visit. Open the PR with the GitHub body in its description
and the screenshots. Ask before pushing, as for any push.

## 5. Tag, only after the notes PR merges and the maintainer says go

```sh
git fetch origin --tags
sha=$(git rev-parse origin/main)
gh run list --branch main --limit 3          # main must be green at $sha
git tag -a vX.Y.Z -m "Sizzle X.Y.Z" "$sha"
git push origin vX.Y.Z
gh run watch "$(gh run list --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

If anything merged after the notes PR, check it's covered by the notes or tag the notes commit
instead. Never tag a commit that isn't on `main`.

## 6. After the workflow is green

1. Replace the generated release notes with the reviewed body:
   `gh release edit vX.Y.Z --notes-file <file>` (file in the scratchpad).
2. Check the image is public and pulls: `docker pull ghcr.io/leemac/sizzle:X.Y.Z`.
3. If it failed: rerun failed jobs for transient errors; for a code fix, release the next patch.
   Never move the tag.

## Report

Give the maintainer: the version and tag SHA, the release URL, the workflow run URL, the image
tags published, the upgrade steps in one line, and anything left for them to do (edit notes,
update their own server).
