# Seasonal marketing samples

These six original sample recipes supplement the bundled development cookbook for
the landing page's seasonal hero. They are marketing capture data, not application
seeds. The photographs illustrate the dishes; they are not photographs of the exact
sample recipes.

## Reproduce the screenshots

Use a disposable snapshot of app revision
`450836948943daa7ae9f1e6f5a60d313f6d3151f`, which renders both system appearances.
Keep its database and Active Storage under a temporary directory. Do not point the
following command at a personal cookbook. After preparing its development database
and loading the standard seeds, run from that snapshot:

```sh
SIZZLE_MARKETING_DEMO=1 bin/rails runner /path/to/marketing/docs/marketing/seed.rb
bin/rails runner 'ViteRuby.commands.build'
bin/rails server -b 127.0.0.1 -p 3212
```

From the marketing checkout, capture the 12 dishes in both appearances:

```sh
node .agents/skills/sizzle-marketing/scripts/capture-hero.mjs http://localhost:3212
node .agents/skills/sizzle-marketing/scripts/check-page.mjs http://127.0.0.1:4173
```

Each lossless WebP shows the actual recipe page in a 390 × 1000 CSS pixel phone
viewport, including the app header, food photograph, title and recipe details.
The raster files contain two physical pixels per CSS pixel. Matching dimensions
and reserved caption space keep the cards and season picker steady when switching.
The existing screenshot URLs remain available.

## Photograph sources

All six photos below use the [Unsplash License](https://unsplash.com/license).
They were downloaded through `SafeHttp`, validated and re-encoded by
`RecipeImages`, and bundled under `images/` with metadata stripped. These photos
are separate from the application's AGPL license. Capturing and seeding use the
bundled files and do not require network access.

| File                 | Photographer and source                                                                                      | Original image                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| roast-chicken.webp   | [Anto Meneghini](https://unsplash.com/photos/roasted-chicken-with-herbs-and-vegetables-in-a-pan-mlQ2_HrjccU) | https://images.unsplash.com/photo-1768238907887-023b7ac9f450 |
| apple-crumble.webp   | [Arturo Añez](https://unsplash.com/photos/apple-crumble-tart-topped-with-ice-cream-XPS1pyTNXN4)              | https://images.unsplash.com/photo-1748621410882-7466fbb84648 |
| lasagna.webp         | [sheri silver](https://unsplash.com/photos/a-slice-of-lasagna-is-served-from-a-baking-dish-ofpQwWR4dfs)      | https://images.unsplash.com/photo-1770908811367-e1232962e81b |
| spring-pasta.webp    | [Bakd&Raw by Karolin Baitinger](https://unsplash.com/photos/green-beans-on-white-ceramic-bowl-VqDT_x3DZj0)   | https://images.unsplash.com/photo-1625128726833-c811f18946b3 |
| strawberry-tart.webp | [Dillon Lobo](https://unsplash.com/photos/strawberry-tart-with-cream-on-pink-background-Uf99X7LTOm8)         | https://images.unsplash.com/photo-1754652327485-e2bd06c2c261 |
| grilled-corn.webp    | [Christina Branco](https://unsplash.com/photos/grilled-corns-ZC4RGR1SGvM)                                    | https://images.unsplash.com/photo-1548365329-6adbd5e89128    |

The other six photographs come from the [bundled sample cookbook](../../db/seeds/README.md).
