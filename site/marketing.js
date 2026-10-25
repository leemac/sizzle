const motion = window.matchMedia('(prefers-reduced-motion: reduce)')

// Northern-hemisphere seasons; the selector also works without JavaScript.
const season = ['winter', 'spring', 'summer', 'autumn'][Math.floor(((new Date().getMonth() + 1) % 12) / 3)]
const seasonalChoice = document.querySelector(`input[name="hero-season"][value="${season}"]`)
if (seasonalChoice) seasonalChoice.checked = true

// Content stays visible without JS, without IntersectionObserver, or with reduced motion.
if (!motion.matches && 'IntersectionObserver' in window) {
  const targets = [...document.querySelectorAll('[data-reveal]')]
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      }
    },
    { threshold: 0.08 },
  )
  document.documentElement.classList.add('motion-ready')
  targets.forEach((target) => observer.observe(target))
  motion.addEventListener('change', () => {
    if (!motion.matches) return
    document.documentElement.classList.remove('motion-ready')
    observer.disconnect()
  })
}
