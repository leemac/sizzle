import Icon from '@/components/Icon'
import type { GalleryLayout } from '@/lib/galleryLayout'

const OPTIONS: [GalleryLayout, string][] = [
  ['grid', 'Show as grid'],
  ['list', 'Show as list'],
]

export default function LayoutToggle({
  value,
  onChange,
}: {
  value: GalleryLayout
  onChange: (layout: GalleryLayout) => void
}) {
  return (
    <div role="group" aria-label="Layout" className="flex rounded-full bg-paper p-1 ring-1 ring-hairline">
      {OPTIONS.map(([layout, label]) => (
        <button
          key={layout}
          type="button"
          aria-pressed={value === layout}
          aria-label={label}
          title={label}
          onClick={() => onChange(layout)}
          className={`grid size-8 place-items-center rounded-full ${value === layout ? 'bg-ink text-porcelain' : 'text-graphite hover:text-ink'}`}
        >
          <Icon name={layout} className="size-4" />
        </button>
      ))}
    </div>
  )
}
