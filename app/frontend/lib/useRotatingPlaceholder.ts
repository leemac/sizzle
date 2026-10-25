import { useEffect, useState } from 'react'

// The kinds of page Sizzle imports, on the reserved .example domain so no one can ever own them.
export const RECIPE_LINK_EXAMPLES = [
  'https://myfoodblog.example/miso-ramen…',
  'https://thenews.example/cooking/lemon-tart…',
  'https://recipesite.example/recipe/dal…',
  'https://supermarket.example/recipes/pesto…',
] as const

const FADE_MS = 200

// Cycles through example placeholders with a short fade. Holds still while paused (e.g. the field has focus, so the
// example doesn't change while you read it) and for people who prefer reduced motion.
export function useRotatingPlaceholder(examples: readonly string[], { paused = false, interval = 3500 } = {}) {
  const [index, setIndex] = useState(0)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (paused || examples.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    let swap: number | undefined
    const timer = window.setInterval(() => {
      setHidden(true)
      swap = window.setTimeout(() => {
        setIndex((current) => (current + 1) % examples.length)
        setHidden(false)
      }, FADE_MS)
    }, interval)

    return () => {
      window.clearInterval(timer)
      window.clearTimeout(swap)
      // Pausing mid-fade (focusing the field) must not leave the placeholder invisible.
      setHidden(false)
    }
  }, [paused, examples.length, interval])

  return {
    placeholder: examples[index % examples.length],
    className: `placeholder:transition-opacity placeholder:duration-200 ${hidden ? 'placeholder:opacity-0' : ''}`,
  }
}
