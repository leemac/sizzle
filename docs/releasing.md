# Releasing Sizzle

Releases are cut by hand by a maintainer. A version tag on `main` is the whole release: the
[release workflow](../.github/workflows/release.yml) builds and publishes the image, then
creates the GitHub release. Nothing is published for ordinary merges to `main`.

## Versions

Sizzle uses [semantic versioning](https://semver.org) with a `v` prefix on tags: `v0.0.1`,
`v0.1.0`, `v1.2.3`. Before 1.0:

- **Patch** (`v0.0.1` → `v0.0.2`): fixes and small changes. Upgrading needs nothing beyond
  `docker compose pull`.
- **Minor** (`v0.0.x` → `v0.1.0`): new features, and any breaking change: a setting renamed or
  removed, a migration that needs attention, a new `docker-compose.yml`. Say what to do in the
  release notes.

Pre-releases (`v0.1.0-rc.1`) get only their exact image tag, never `latest`.

Release runs are serialized across versions, with up to 100 pending runs queued instead of
replaced by newer tags. Floating image tags (`latest`, minor and major)
advance only to an equal or newer stable version, so a delayed release or a backport cannot
downgrade them. An older release also leaves GitHub's latest release unchanged.

## Cut a release

1. Prepare the in-app notes in `config/releases.json` using the process below, and have that
   change reviewed and merged. Make sure `main` is green in CI and has everything you want to ship.
2. Tag the commit on `main` and push the tag:

   ```sh
   git switch main && git pull
   git tag -a v0.0.1 -m "Sizzle 0.0.1"
   git push origin v0.0.1
   ```

3. Watch the **Release** workflow (`gh run watch`). It:
   1. checks the tag is a version and points at a commit on `main`;
   2. runs all of CI again on that commit;
   3. builds `linux/amd64` and `linux/arm64` on native runners, with the version baked in
      (the app footer shows it), plus an SBOM and build provenance;
   4. publishes the exact image tag (`0.0.1`) and signs its provenance, then advances `0.0`
      and `latest` if they don't already point to a newer version (and the major tag, `1`,
      from 1.0 on);
   5. creates the GitHub release with generated notes and attaches `docker-compose.yml` and
      `env.example`, which the install instructions download from `releases/latest`.

4. Edit the release notes on GitHub if upgrading needs any steps.

You can also start from `gh release create v0.0.1 --generate-notes`, which creates the tag
for you. The workflow then attaches the files to that release, but the release page appears
before the image is pushed, so the install commands fail for the ~15 minutes the build takes.

Retry transient failures with GitHub Actions' **Re-run failed jobs**. A full rerun may rebuild
the platform images, but if the exact version was already published, publication reuses its
original digest, checks that it belongs to the same commit, and resumes attestation and tag
promotion. Rebuilt images never replace an existing exact version. Registry access failures
stop publication rather than being treated as a missing tag.

If a fix requires a code change, release the next patch version. Never move or reuse a version
tag, including after a partially failed release.

## In-app release journal

`/releases` reads `config/releases.json`, bundled in the image. It never contacts GitHub.
The header's quiet dot means there are unread bundled notes, not that a newer image is
available. Opening the journal remembers the newest visible version in this browser.
Versioned builds show entries at or below their own version; development shows all entries.

Before choosing the final release SHA, prepend an entry with the proposed `version` (without
`v`), intended release `date` (`YYYY-MM-DD`), and `sections` (`title` and `paragraphs`).
Use the published release prose directly, without editorial titles, summaries or commentary.
Use plain text; React escapes it. Keep upgrade steps, opt-in settings, privacy implications
and limitations in the full notes. Use only changes actually included in the candidate.
GitHub notes may include extra PR links, but their claims and upgrade guidance must agree.

Have the notes change reviewed and merged before tagging; publishing GitHub notes afterward
cannot add them to an already-built image. If the version, date or scope changes, update the
entry and revalidate the new candidate. Do not move an existing tag to repair old notes.

Check `bin/rails test test/models/release_notes_test.rb test/controllers/releases_controller_test.rb`,
`npm test -- ReleaseNotesLink` and the release browser tests, then `bin/ci`. Preview `/releases`
at 390px and 1280px, including expanded notes and the unread dot clearing after a visit.
The initial backfill covers every published stable release from v0.0.1 through v0.3.1;
published dates and prose came from the corresponding GitHub releases.

## First release only

GitHub creates the `sizzle` package as **private** the first time the workflow pushes it.
After the first release, open the package settings
(`https://github.com/users/leemac/packages/container/sizzle/settings`) and change its
visibility to **Public**, or nobody else can pull the image. Check it worked from a machine
that isn't logged in to ghcr.io:

```sh
docker pull ghcr.io/leemac/sizzle:0.0.1
```
