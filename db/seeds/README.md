# Development sample cookbook

Run `bin/rails db:seed` to load 21 complete recipes and their bundled food photos.
No API key or internet connection is needed. Only development is seeded unless
`SEED_ANYWAY` is explicitly set.

The recipe text was written for Sizzle as sample content, rather than copied from
recipe sites. Photos illustrate the dishes; they are stock photographs, not
photographs of these exact recipes. The set covers nine courses, nine cuisines,
several diets, quick meals, longer baking projects, six drinks (including two
mocktails), ingredient sections, quantity ranges, optional quantities, and yields without a serving count. Rising, chilling
and oven preheating times are described in the methods and tips where applicable.

Re-running seeds skips existing titles, preserving edits to the new samples and
recipes you import. Original placeholder records are upgraded in place when their
title, example.com source, generic description and empty notes/rating still match.
Placeholders linked to an import are left alone. The upgrade changes some dish
names to match the new content and photos; it does not reset the database.

## Photograph sources

These WebP files are separate from the AGPL-licensed application code. Except for
the cucumber cooler photo noted below, they are provided under the
[Unsplash License](https://unsplash.com/license), which permits
downloading, modifying and redistributing photos for commercial and non-commercial
use, subject to its restrictions. See that license for the full terms. The images
were downloaded through `SafeHttp`, validated and re-encoded by `RecipeImages`,
with metadata stripped. They are bundled so development and tests stay offline.

| File | Original image |
| --- | --- |
| avocado-toast.webp | https://images.unsplash.com/photo-1525351484163-7529414344d8 |
| banana-bread.webp | https://images.unsplash.com/photo-1605286978633-2dec93ff88a2 |
| berry-tarts.webp | https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81 |
| bread.webp | https://images.unsplash.com/photo-1509440159596-0249088772ff |
| cookies.webp | https://images.unsplash.com/photo-1499636136210-6f4ee915583e |
| curry.webp | https://images.unsplash.com/photo-1585937421612-70a008356fbe |
| fries.webp | https://images.unsplash.com/photo-1573080496219-bb080dd4f877 |
| milkshake.webp | https://images.unsplash.com/photo-1577805947697-89e18249d767 |
| noodles.webp | https://images.unsplash.com/photo-1569718212165-3a8278d5f624 |
| pancakes.webp | https://images.unsplash.com/photo-1528207776546-365bb710ee93 |
| pasta.webp | https://images.unsplash.com/photo-1551183053-bf91a1d81141 |
| pizza.webp | https://images.unsplash.com/photo-1574071318508-1cdbab80d002 |
| salad.webp | https://images.unsplash.com/photo-1512621776951-a57141f2eefd |
| salmon.webp | https://images.unsplash.com/photo-1467003909585-2f8a72700288 |
| soup.webp | https://images.unsplash.com/photo-1547592166-23ac45744acd |
| tacos.webp | https://images.unsplash.com/photo-1565299585323-38d6b0865b47 |
| ginger-lime-spritz.webp | https://images.unsplash.com/photo-1560523967-bcfe1e72c2f4 (Caglar Araz) |
| hibiscus-iced-tea.webp | https://images.unsplash.com/photo-1599390719602-2874f553a716 (yeoul Shin) |
| iced-coffee.webp | https://images.unsplash.com/photo-1767471717029-44be10fbf123 (Rob Wingate) |
| strawberry-lemonade.webp | https://images.unsplash.com/photo-1497534446932-c925b458314e |

The `cucumber-mint-cooler.webp` photograph is by Timur Weber on
[Pexels](https://www.pexels.com/photo/water-with-slices-of-cucumber-in-drinking-glass-8679633/)
and is provided under the [Pexels License](https://www.pexels.com/license/).

Drinks use the existing `drink` course. Tags distinguish `mocktail`,
`caffeine-free`, `caffeinated`, `make-ahead`, and `batch`; no new diet values or
configuration are required. Tea steeping and syrup cooling are included in total
times. Iced coffee assumes brewed coffee has already been chilled, as noted in the
recipe. Stock cocktail photographs illustrate the alcohol-free spritz.

## Previews

Drink gallery screenshots: [390px](../../docs/screenshots/seed-drinks-390.jpg) and
[1280px](../../docs/screenshots/seed-drinks-1280.jpg).
