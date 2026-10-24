import { useEffect, useRef } from 'react'
import config from './sizzle-logo-config.json'

export default function SizzleLogo() {
  const field = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const pixels = [...field.current!.querySelectorAll('rect')]
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let randomState = config.seed
    let frame: number | null = null
    let previousTime: number | null = null

    function random() {
      randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0
      return randomState / 4294967296
    }

    function spawn(warm = false) {
      const origin = random() - 0.5
      const life = 5.5 + random() * 4.5
      return {
        origin,
        life,
        age: warm ? random() * life : 0,
        drift: (origin < 0 ? -1 : 1) * (0.5 + random() * 0.5),
        rise: 0.7 + random() * 0.3,
        phase: random() * Math.PI * 2,
        sway: 0.5 + random(),
        size: 0.85 + random() * 0.3,
      }
    }

    const particles = Array.from({ length: config.count }, () => spawn(true))

    function paint() {
      // The square SVG spans 1.25em, so these distances scale with the wordmark.
      const unitsPerEm = 32 / 1.25
      particles.forEach((particle, index) => {
        const t = particle.age / particle.life
        const x =
          16 +
          particle.origin * config.sourceWidthEm * unitsPerEm +
          particle.drift * config.spreadEm * unitsPerEm * t +
          Math.sin(particle.age * 0.8 + particle.phase) * particle.sway * config.wander * t
        const lift = Math.max(
          0,
          Math.min(
            config.riseEm * unitsPerEm,
            config.riseEm * unitsPerEm * particle.rise * t +
              Math.sin(particle.age * 0.6 + particle.phase) * config.wander * 0.25 * t,
          ),
        )
        const twinkle = 1 - 0.1 * t * (1 + Math.sin(particle.age * 3 + particle.phase))
        const opacity = Math.min(1, t * 9) * Math.pow(1 - t, 1.15) * config.opacity * twinkle
        const size = config.pixelSizeEm * unitsPerEm * particle.size
        const pixel = pixels[index]
        pixel.setAttribute('x', x.toFixed(3))
        pixel.setAttribute('y', (31 - lift).toFixed(3))
        pixel.setAttribute('width', size.toFixed(3))
        pixel.setAttribute('height', size.toFixed(3))
        pixel.setAttribute('opacity', opacity.toFixed(3))
      })
    }

    function tick(time: number) {
      const dt = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, 0.05)
      previousTime = time
      particles.forEach((particle) => {
        particle.age += dt * config.speed
        if (particle.age >= particle.life) Object.assign(particle, spawn())
      })
      paint()
      frame = requestAnimationFrame(tick)
    }

    function updateMotion() {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
      previousTime = null
      if (config.animate && !reducedMotion.matches && !document.hidden) frame = requestAnimationFrame(tick)
    }

    paint()
    updateMotion()
    reducedMotion.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateMotion)
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      reducedMotion.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', updateMotion)
    }
  }, [])

  return (
    <span className="sizzle-logo" role="img" aria-label="Sizzle">
      <span aria-hidden="true">
        Si
        <span className="sizzle-logo__letters">
          zz
          <svg ref={field} className="sizzle-logo__particles" viewBox="0 0 32 32" aria-hidden="true">
            {Array.from({ length: config.count }, (_, index) => (
              <rect key={index} opacity="0" />
            ))}
          </svg>
        </span>
        le
      </span>
    </span>
  )
}
