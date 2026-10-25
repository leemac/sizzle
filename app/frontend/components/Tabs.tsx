import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export type Tab = { id: string; label: string; content: ReactNode }

// Accessible tabs: arrow keys, Home and End move between tabs, and only the selected tab is in the tab order.
export default function Tabs({ label, tabs, initial }: { label: string; tabs: Tab[]; initial?: string }) {
  const [selected, setSelected] = useState(() => (tabs.some((tab) => tab.id === initial) ? initial : tabs[0].id))
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const prefix = useId()
  const index = tabs.findIndex((tab) => tab.id === selected)

  const select = (next: number) => {
    const position = (next + tabs.length) % tabs.length
    setSelected(tabs[position].id)
    buttons.current[position]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }
    if (!(event.key in moves)) return
    event.preventDefault()
    select(moves[event.key])
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-paper p-1 ring-1 ring-hairline sm:inline-grid"
      >
        {tabs.map((tab, position) => (
          <button
            key={tab.id}
            ref={(element) => {
              buttons.current[position] = element
            }}
            type="button"
            role="tab"
            id={`${prefix}-tab-${tab.id}`}
            aria-selected={tab.id === selected}
            aria-controls={`${prefix}-panel-${tab.id}`}
            tabIndex={tab.id === selected ? 0 : -1}
            onClick={() => setSelected(tab.id)}
            onKeyDown={onKeyDown}
            className={`rounded-full px-3 py-2.5 text-sm whitespace-nowrap sm:px-5 ${tab.id === selected ? 'bg-active font-semibold text-on-active' : 'text-graphite hover:text-ink'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${prefix}-panel-${selected}`}
        aria-labelledby={`${prefix}-tab-${selected}`}
        tabIndex={0}
        className="mt-4"
      >
        {tabs[index].content}
      </div>
    </div>
  )
}
