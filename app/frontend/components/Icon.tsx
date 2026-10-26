const PATHS = {
  journal: 'M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM7 3v18M10 8h6M10 12h6M10 16h3',
  settings:
    'M10 3h4l.6 2.4 2 .9 2.2-.7 2 3.4-1.6 1.7v2.6l1.6 1.7-2 3.4-2.2-.7-2 .9L14 21h-4l-.6-2.4-2-.9-2.2.7-2-3.4 1.6-1.7v-2.6L3.2 9l2-3.4 2.2.7 2-.9L10 3Zm2 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.35-4.35',
  plus: 'M12 5v14M5 12h14',
  image: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM4 16l5-5 4 4 2-2 5 5M15 8.5h.01',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  back: 'M15 18l-6-6 6-6',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  play: 'M9 6v12l10-6Z',
  youtube: 'M21 8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V8ZM10 9l5 3-5 3V9Z',
  close: 'M6 6l12 12M18 6 6 18',
  share: 'M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5',
  check: 'M5 12.5 10 17 19 7',
  edit: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4',
  appearance: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0v18M12 7.5h5.5M12 12h8M12 16.5h5.5',
  print: 'M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7v-7Z',
  heart:
    'M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 3.8 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.2 0 5.4 2.7 4.2 6.1C19.5 15.4 12 20 12 20Z',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM12 7.5V12l3 2',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M4 5h4v4H4zM4 15h4v4H4zM11 7h9M11 17h9',
  alert: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7.5V13M12 16.5v.01',
  lifebuoy:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6',
} as const

export type IconName = keyof typeof PATHS

export default function Icon({
  name,
  className = 'size-5',
  filled = false,
}: {
  name: IconName
  className?: string
  filled?: boolean
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
