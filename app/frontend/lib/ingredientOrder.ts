import { useCallback, useState } from 'react'

export type IngredientOrder = 'recipe' | 'type'

const KEY = 'sizzle:ingredient-order'
const ORDERS: readonly IngredientOrder[] = ['recipe', 'type']

// Touching localStorage at all can throw when the browser blocks site data,
// so every access stays inside a try.

/** The ingredient order this browser last chose. Falls back to recipe order if storage is empty, blocked or holds junk. */
export function readIngredientOrder(): IngredientOrder {
  try {
    const stored = globalThis.localStorage?.getItem(KEY)
    return ORDERS.find((order) => order === stored) ?? 'recipe'
  } catch {
    return 'recipe'
  }
}

export function writeIngredientOrder(order: IngredientOrder) {
  try {
    globalThis.localStorage?.setItem(KEY, order)
  } catch {
    // Private windows and blocked storage: the choice just won't stick.
  }
}

/** Recipe order or grouped by type for ingredient lists, remembered per browser. */
export function useIngredientOrder(): [IngredientOrder, (order: IngredientOrder) => void] {
  const [order, setOrder] = useState(() => readIngredientOrder())
  const choose = useCallback((next: IngredientOrder) => {
    setOrder(next)
    writeIngredientOrder(next)
  }, [])
  return [order, choose]
}
