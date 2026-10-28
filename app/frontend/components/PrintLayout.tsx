import type { ReactNode, Ref } from 'react'

/** Shared paper, branding and footer for Sizzle printouts. */
export default function PrintLayout({
  children,
  footer,
  source,
  className = '',
  ref,
  testId,
}: {
  children: ReactNode
  footer?: ReactNode
  source?: string | null
  className?: string
  ref?: Ref<HTMLDivElement>
  testId?: string
}) {
  return (
    <div ref={ref} className={`print-sheet ${className}`} data-testid={testId}>
      <header className="print-sheet__masthead">
        <span className="print-sheet__brand">Sizzle</span>
        {source && <span className="print-sheet__clip">{source}</span>}
      </header>
      {children}
      <footer className="print-sheet__footer">
        {footer}
        <a className="print-sheet__site" href="https://sizzle.mckinnon.dev">
          https://sizzle.mckinnon.dev
        </a>
      </footer>
    </div>
  )
}
