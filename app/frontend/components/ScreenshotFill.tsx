import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import { MAX_SCREENSHOTS, SCREENSHOT_TYPES, type ScreenshotFields, screenshotFiles } from '@/lib/screenshotFill'

type Status =
  | { state: 'idle' }
  | { state: 'reading'; count: number }
  | { state: 'filled'; filled: number; kept: number }
  | { state: 'error'; message: string }

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/**
 * Sends pasted, dropped or chosen screenshots to Claude and hands the fields it read to the form. Nothing is saved
 * until the form is submitted.
 */
export default function ScreenshotFill({
  onFields,
}: {
  onFields: (fields: Partial<ScreenshotFields>) => { filled: number; kept: number }
}) {
  const [status, setStatus] = useState<Status>({ state: 'idle' })
  const [dragging, setDragging] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const reading = status.state === 'reading'
  const readingRef = useRef(false)
  // Claude takes a while; merge into the form as it is when the answer arrives, not when the upload started.
  const onFieldsRef = useRef(onFields)
  useEffect(() => {
    onFieldsRef.current = onFields
  })

  const read = async (files: File[]) => {
    if (readingRef.current) return
    if (files.length === 0) {
      setStatus({ state: 'error', message: 'Add a PNG, JPEG, WebP or GIF screenshot.' })
      return
    }
    if (files.length > MAX_SCREENSHOTS) {
      setStatus({ state: 'error', message: `Add up to ${MAX_SCREENSHOTS} screenshots at a time.` })
      return
    }

    readingRef.current = true
    setStatus({ state: 'reading', count: files.length })
    const body = new FormData()
    files.forEach((file) => body.append('screenshots[]', file))
    try {
      const response = await fetch('/imports/screenshots', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'X-CSRF-Token': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
        },
        body,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || typeof data.fields !== 'object' || data.fields === null) {
        setStatus({ state: 'error', message: data.error ?? 'Couldn’t read that screenshot. Try again.' })
      } else {
        setStatus({ state: 'filled', ...onFieldsRef.current(data.fields) })
      }
    } catch {
      setStatus({ state: 'error', message: 'Couldn’t reach Sizzle. Check your connection and try again.' })
    } finally {
      readingRef.current = false
    }
  }
  const readRef = useRef(read)
  useEffect(() => {
    readRef.current = read
  })

  // Pasting or dropping an image anywhere on the page fills the form; pasting text still goes into the field,
  // and a dropped image doesn't open in place of the page.
  useEffect(() => {
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false
    const paste = (event: ClipboardEvent) => {
      const files = screenshotFiles(event.clipboardData?.files)
      if (files.length === 0) return
      event.preventDefault()
      readRef.current(files)
    }
    const dragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      setDragging(true)
    }
    const dragLeave = (event: DragEvent) => {
      if (event.relatedTarget === null) setDragging(false)
    }
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      setDragging(false)
      readRef.current(screenshotFiles(event.dataTransfer?.files))
    }
    document.addEventListener('paste', paste)
    document.addEventListener('dragover', dragOver)
    document.addEventListener('dragleave', dragLeave)
    document.addEventListener('drop', drop)
    return () => {
      document.removeEventListener('paste', paste)
      document.removeEventListener('dragover', dragOver)
      document.removeEventListener('dragleave', dragLeave)
      document.removeEventListener('drop', drop)
    }
  }, [])

  return (
    <section
      aria-labelledby="screenshot-heading"
      aria-busy={reading}
      className={`rounded-photo border border-dashed p-4 transition-colors sm:p-5 ${dragging ? 'border-ink bg-porcelain' : 'border-hairline'}`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-56">
          <h2 id="screenshot-heading" className="font-medium">
            Fill from a screenshot
          </h2>
          <p id="screenshot-hint" className="mt-1 text-sm text-graphite">
            Paste or drop a screenshot of the recipe, or choose up to {MAX_SCREENSHOTS}. Claude reads it and fills in
            the empty fields.
          </p>
        </div>
        <button
          type="button"
          disabled={reading}
          onClick={() => picker.current?.click()}
          aria-describedby="screenshot-hint"
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-hairline hover:ring-ink/30 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-50"
        >
          <Icon name="image" className="size-4" />
          Choose screenshots
        </button>
        <input
          ref={picker}
          type="file"
          accept={SCREENSHOT_TYPES.join(',')}
          multiple
          hidden
          tabIndex={-1}
          onChange={(event) => {
            read(screenshotFiles(event.target.files))
            event.target.value = ''
          }}
        />
      </div>
      <div aria-live="polite" className="text-sm empty:hidden">
        {status.state === 'reading' && (
          <p className="mt-3 flex items-center gap-2">
            <span className="flex gap-1" aria-hidden="true">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="import-dot size-1 rounded-full bg-ink"
                  style={{ animationDelay: `${dot * 140}ms` }}
                />
              ))}
            </span>
            Reading {status.count === 1 ? 'your screenshot' : plural(status.count, 'screenshot')}…
          </p>
        )}
        {status.state === 'filled' && (
          <p className="mt-3">
            {status.filled > 0
              ? `Filled in ${plural(status.filled, 'field')}. Check them before saving.`
              : 'No empty fields to fill.'}
            {status.kept > 0 && ` Kept ${plural(status.kept, 'field')} you’d already filled in.`}
          </p>
        )}
        {status.state === 'error' && (
          <p role="alert" className="mt-3 text-danger">
            {status.message}
          </p>
        )}
      </div>
    </section>
  )
}
