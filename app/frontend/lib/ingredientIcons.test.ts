import { describe, expect, it } from 'vitest'
import { INGREDIENT_ICONS, ingredientIcon, type IngredientIconName } from './ingredientIcons'

describe('ingredientIcon', () => {
  it.each<[string, IngredientIconName]>([
    ['3 large chicken breasts', 'poultry'],
    ['¼ cup extra virgin olive oil', 'oil'],
    ['16 black Kalamata olives, pitted', 'olive'],
    ['16 cherry tomatoes', 'tomato'],
    ['3–4 anchovies', 'fish'],
    ['salt and pepper', 'salt-pepper'],
    ['2 jalapeños', 'chilli'],
    ['1 red pepper, sliced', 'bell-pepper'],
    ['1/2 tsp red pepper flakes', 'spice'],
    ['1/4 tsp cayenne pepper', 'spice'],
    ['2 tbsp peanut butter', 'nut'],
    ['1 tin coconut milk', 'tin'],
    ['2 cups chicken stock', 'stock'],
  ])('matches %s', (item, icon) => {
    expect(ingredientIcon(item)).toBe(icon)
  })

  it('prefers the last ingredient word, which names the thing', () => {
    expect(ingredientIcon('1-2 tsp chili garlic sauce')).toBe('sauce')
    expect(ingredientIcon('Peanut sauce')).toBe('sauce')
    expect(ingredientIcon('1/2 tsp celery salt')).toBe('salt-pepper')
    expect(ingredientIcon('2 celery ribs, chopped (1/3 cup)')).toBe('celery')
    expect(ingredientIcon('2 garlic cloves, minced')).toBe('garlic')
  })

  it('ignores notes in brackets and preparation after a comma', () => {
    expect(ingredientIcon('4 cups water (or veggie stock)')).toBe('water')
    expect(ingredientIcon('3/4 cup buttermilk ((Note 2 for yogurt/milk sub))')).toBe('milk')
    expect(ingredientIcon('1 cup extra firm tofu, pressed and crumbled or cubed*')).toBe('tofu')
    expect(ingredientIcon('500g / 1lb chicken breast (, skinless boneless (Note 1))')).toBe('poultry')
    expect(ingredientIcon('2 tbsp butter (unclosed note about oil')).toBe('butter')
  })

  it('falls back to the whole line when the name before a comma matches nothing', () => {
    expect(ingredientIcon('neutral, high smoke point oil')).toBe('oil')
  })

  it('matches whole words only', () => {
    expect(ingredientIcon('1 cup peanuts')).toBe('nut')
    expect(ingredientIcon('frozen peas')).toBe('beans')
    expect(ingredientIcon('2 tbsp cornflour')).toBe('tin')
    expect(ingredientIcon('1 tsp teaspoon')).toBeNull()
  })

  it('returns null when nothing fits', () => {
    expect(ingredientIcon('2 tbsp dried culinary hibiscus')).toBeNull()
    expect(ingredientIcon('')).toBeNull()
    expect(ingredientIcon('((((')).toBeNull()
  })

  it('stays fast on long hostile input', () => {
    const started = performance.now()
    ingredientIcon(`${'('.repeat(2000)}salt ${'a '.repeat(2000)}`)
    ingredientIcon('salt '.repeat(2000))
    expect(performance.now() - started).toBeLessThan(500)
  })
})

describe('INGREDIENT_ICONS', () => {
  const entries = Object.entries(INGREDIENT_ICONS)

  it('draws every icon as plain path commands', () => {
    for (const [, icon] of entries) expect(icon.d).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/)
  })

  it('maps each keyword on its own back to its icon', () => {
    for (const [name, icon] of entries) {
      for (const keyword of icon.keywords) expect([keyword, ingredientIcon(keyword)]).toEqual([keyword, name])
    }
  })
})
