# Third-party notices

Sizzle's own code is licensed under the AGPL-3.0 (see [LICENSE](LICENSE)). It also redistributes the
following third-party material under its own license.

## Bricolage Grotesque (font)

Copyright 2022 The Bricolage Grotesque Project Authors (https://github.com/ateliertriay/bricolage)
Licensed under the SIL Open Font License, Version 1.1. The full text is in
[licenses/Bricolage-Grotesque-OFL.txt](licenses/Bricolage-Grotesque-OFL.txt), and for the website in
[site/fonts/OFL.txt](site/fonts/OFL.txt).

- `site/fonts/bricolage-grotesque.woff2`: latin subset, weight axis, from `@fontsource-variable/bricolage-grotesque` 5.3.0
- The app bundles the font from `@fontsource-variable/bricolage-grotesque` into its built assets.

## JavaScript and Ruby dependencies

The built frontend bundle and the Docker image include npm packages (e.g. React, Inertia.js) and Ruby
gems under their own licenses, mostly MIT, BSD and Apache-2.0. See `package-lock.json` and `Gemfile.lock`
for the full list; each package's license ships with its source distribution.
