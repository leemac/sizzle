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

## Cut a release

1. Make sure `main` is green in CI and has everything you want to ship.
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
      (Setup shows it), plus an SBOM and build provenance;
   4. pushes `ghcr.io/leemac/sizzle` tagged `0.0.1`, `0.0` and `latest` (and the major
      version, `1`, from 1.0 on), and signs a provenance attestation for it;
   5. creates the GitHub release with generated notes and attaches `docker-compose.yml` and
      `env.example`, which the install instructions download from `releases/latest`.

4. Edit the release notes on GitHub if upgrading needs any steps.

You can also start from `gh release create v0.0.1 --generate-notes`, which creates the tag
for you. The workflow then attaches the files to that release, but the release page appears
before the image is pushed, so the install commands fail for the ~15 minutes the build takes.

If the workflow fails before **Publish image**, nothing was published: fix the problem on
`main`, delete the tag (`git push origin :v0.0.1 && git tag -d v0.0.1`) and tag again. Once
an image is published, don't move or reuse its tag; release the next patch version instead.

## First release only

GitHub creates the `sizzle` package as **private** the first time the workflow pushes it.
After the first release, open the package settings
(`https://github.com/users/leemac/packages/container/sizzle/settings`) and change its
visibility to **Public**, or nobody else can pull the image. Check it worked from a machine
that isn't logged in to ghcr.io:

```sh
docker pull ghcr.io/leemac/sizzle:0.0.1
```
