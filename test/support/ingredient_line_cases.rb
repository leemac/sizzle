module IngredientLineCases
  # Source spaces are preserved where the supplied examples had joined words.
  CASES = [
    [ "1 cup extra firm tofu, pressed and crumbled or cubed*", 1, nil, "cup", "extra firm tofu", "pressed and crumbled or cubed", nil ],
    [ "3–4 anchovies", 3, 4, nil, "anchovies", nil, nil ],
    [ "1-1/2 pounds boneless skinless chicken breasts, cut into thin strips", 1.5, nil, "pound", "boneless skinless chicken breasts", "cut into thin strips", nil ],
    [ "1-2 tsp chili garlic sauce", 1, 2, "tsp", "chili garlic sauce", nil, nil ],
    [ "½ teaspoon garlic powder", 0.5, nil, "tsp", "garlic powder", nil, nil ],
    [ "1 Tbsp. butter", 1, nil, "tbsp", "butter", nil, nil ],
    [ "2 cloves garlic, minced", 2, nil, "clove", "garlic", "minced", nil ],
    [ "2 garlic cloves, minced", 2, nil, nil, "garlic cloves", "minced", nil ],
    [ "3/4 cup buttermilk ((Note 2 for yogurt/milk sub))", 0.75, nil, "cup", "buttermilk", nil, "Note 2 for yogurt/milk sub" ],
    [ "500g / 1lb chicken breast (, skinless boneless, tenderloin or boneless thighs (Note 1))", 500, nil, "g", "chicken breast", nil, "1lb; skinless boneless, tenderloin or boneless thighs" ],
    [ "1 medium zucchini, diced into 1/2-inch cubes, (1 1/2 cups)", 1, nil, nil, "medium zucchini", "diced into 1/2-inch cubes", "1 1/2 cups" ],
    [ "6 flour tortillas (8 inches), warmed", 6, nil, nil, "flour tortillas", "warmed", "8 inches" ],
    [ "1 can (14 oz) diced tomatoes", 1, nil, "can", "diced tomatoes", nil, "14 oz" ],
    [ '2 1/2 - 3 1/2 cups canola oil (2.5 cm / 1" depth)', 2.5, 3.5, "cup", "canola oil", nil, '2.5 cm / 1" depth' ],
    [ "salt", nil, nil, nil, "salt", nil, nil ],
    [ "Kosher salt and fresh ground black pepper", nil, nil, nil, "Kosher salt and fresh ground black pepper", nil, nil ],
    [ "neutral, high smoke point oil", nil, nil, nil, "neutral, high smoke point oil", nil, nil ],
    [ "Optional: Shredded cheddar cheese, taco sauce, salsa", nil, nil, nil, "Optional: Shredded cheddar cheese, taco sauce, salsa", nil, nil ]
  ].freeze
end
