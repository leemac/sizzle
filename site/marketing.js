const motion = window.matchMedia('(prefers-reduced-motion: reduce)')

// Northern-hemisphere seasons; the selector also works without JavaScript.
const season = ['winter', 'spring', 'summer', 'autumn'][Math.floor(((new Date().getMonth() + 1) % 12) / 3)]
const seasonalChoice = document.querySelector(`input[name="hero-season"][value="${season}"]`)
const hero = document.querySelector('.hero-screen')
if (hero) {
  hero.dataset.activeSeason = hero.querySelector('input[name="hero-season"]:checked').value

  const showSeason = async (choice) => {
    const images = hero.querySelectorAll(`[data-season="${choice.value}"] img`)
    try {
      // Hidden seasons are lazy-loaded. Keep the current stack until every card is ready to paint.
      await Promise.all(
        [...images].map((img) => {
          img.loading = 'eager'
          return img.decode()
        }),
      )
    } catch {
      if (choice.checked) hero.querySelector(`input[value="${hero.dataset.activeSeason}"]`).checked = true
      return
    }
    // A slower request must not replace a more recent selection.
    if (choice.checked) hero.dataset.activeSeason = choice.value
  }

  hero.querySelectorAll('input[name="hero-season"]').forEach((choice) => {
    choice.addEventListener('change', () => showSeason(choice))
  })
  if (seasonalChoice) {
    seasonalChoice.checked = true
    showSeason(seasonalChoice)
  }
}

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

document.querySelectorAll('.code-block').forEach((block) => {
  const copyButton = block.querySelector('.copy-code')
  copyButton.hidden = false
  copyButton.addEventListener('click', async () => {
    const code = block.querySelector('code')
    const status = block.querySelector('.copy-status')
    try {
      await navigator.clipboard.writeText(code.textContent)
      status.textContent = 'Commands copied.'
    } catch {
      code.closest('pre').focus()
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(code)
      selection.removeAllRanges()
      selection.addRange(range)
      status.textContent = 'Copy unavailable. Commands selected; use your browser’s Copy command.'
    }
  })
})
