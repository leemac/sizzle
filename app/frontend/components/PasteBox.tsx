import { Link, router } from '@inertiajs/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import { handOffFiles } from '@/lib/fileHandoff'
import { PDF_TYPE, SCREENSHOT_TYPES, screenshotFiles, screenshotFilesError } from '@/lib/screenshotFill'

// Taller batches scroll inside the box rather than pushing the cookbook off the screen.
const MAX_HEIGHT = 192
const MAX_LINKS = 20
const EASE = [0.2, 0.8, 0.2, 1] as const

const hasFiles = (event: React.DragEvent) => event.dataTransfer.types.includes('Files')

/** What's in the box, in a few words, once there's more than one line of it. */
export function pasteHint(input: string): string | null {
  const words = input.split(/\s+/).filter(Boolean)
  if (words.length > 1 && words.every((word) => /^https?:\/\//i.test(word))) {
    return words.length > MAX_LINKS
      ? `${words.length} links · up to ${MAX_LINKS} at a time`
      : `${words.length} links · Enter imports them all`
  }
  return input.includes('\n') ? 'Enter to import · Shift+Enter for a new line' : null
}

/**
 * The cookbook's main action: paste a link, several links or a recipe and press Enter. Accepted imports appear as
 * pending tiles right below. A PDF or screenshot opens Write a recipe, where Claude fills in the fields for review.
 */
export default function PasteBox({
  claudeConfigured,
  automaticAi,
}: {
  claudeConfigured: boolean
  automaticAi: boolean
}) {
  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsClaude, setNeedsClaude] = useState(false)
  const [ghost, setGhost] = useState<{ key: number; text: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [height, setHeight] = useState<number | null>(null)
  const [scrolls, setScrolls] = useState(false)
  const mirror = useRef<HTMLDivElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const reduceMotion = useReducedMotion()
  // Short enough for one line beside the buttons on a phone. The label names everything the box takes.
  const placeholder = dragging
    ? 'Drop a PDF or screenshot'
    : ghost
      ? ''
      : claudeConfigured
        ? 'Paste a link, recipe or PDF'
        : 'Paste a recipe link'
  const hint = pasteHint(input)
  const problem = error ?? (needsClaude ? 'needs-claude' : null)

  // A hidden copy of the text, with the same width and type, says how tall the box needs to be. The observer catches
  // both typing and a change of width.
  useLayoutEffect(() => {
    const measure = () => {
      const natural = mirror.current?.offsetHeight ?? 0
      if (natural === 0) return
      setHeight(Math.min(natural, MAX_HEIGHT))
      setScrolls(natural > MAX_HEIGHT)
    }
    measure()
    if (typeof ResizeObserver === 'undefined' || !mirror.current) return
    const observer = new ResizeObserver(measure)
    observer.observe(mirror.current)
    return () => observer.disconnect()
  }, [])

  const submit = () => {
    const text = input
    if (processing || text.trim() === '') return
    router.post(
      '/imports',
      { input: text, automatic_ai: automaticAi, return_to: 'cookbook' },
      {
        preserveScroll: true,
        preserveState: true,
        onStart: () => {
          setProcessing(true)
          setError(null)
          setNeedsClaude(false)
        },
        onError: (errors) => setError(errors.input ?? 'Couldn’t import that. Check the link and try again.'),
        onSuccess: (page) => {
          // A duplicate needs a choice on the import page; that page keeps the links.
          if (page.component !== 'recipes/index') return
          setInput('')
          setGhost({ key: Date.now(), text })
        },
        onFinish: () => setProcessing(false),
      },
    )
  }

  const takeFiles = (files: File[]) => {
    setError(null)
    if (!claudeConfigured) {
      setNeedsClaude(true)
      return
    }
    const fileProblem = screenshotFilesError(files)
    if (fileProblem) {
      setError(fileProblem)
      return
    }
    handOffFiles(files)
    router.visit('/imports?mode=manual')
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      aria-busy={processing}
      className="mb-8"
    >
      <label htmlFor="paste-box" className="sr-only">
        {claudeConfigured ? 'Recipe link, text, PDF or screenshot' : 'Recipe links'}
      </label>
      <div
        onDragOver={(event) => {
          if (!hasFiles(event)) return
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={(event) => {
          if (!hasFiles(event)) return
          event.preventDefault()
          setDragging(false)
          takeFiles(screenshotFiles(event.dataTransfer.files))
        }}
        className={`flex items-end gap-1 rounded-photo bg-paper p-1.5 transition-shadow duration-200 sm:gap-2 sm:p-2 ${
          dragging
            ? 'ring-2 ring-ink ring-offset-2 ring-offset-porcelain'
            : 'ring-1 ring-hairline focus-within:ring-2 focus-within:ring-ink'
        }`}
      >
        <div className="relative min-w-0 flex-1">
          <div
            ref={mirror}
            aria-hidden="true"
            className="invisible absolute inset-x-0 top-0 pr-1 pl-3 py-2.5 text-base leading-6 break-words whitespace-pre-wrap"
          >
            {input}
            {'​'}
          </div>
          <motion.textarea
            id="paste-box"
            rows={1}
            enterKeyHint="go"
            aria-invalid={!!error}
            aria-describedby={problem ? 'paste-error' : hint ? 'paste-hint' : undefined}
            readOnly={processing}
            value={input}
            placeholder={placeholder}
            // An empty box holds its placeholder on one line rather than wrapping it out of sight.
            wrap={input === '' ? 'off' : 'soft'}
            initial={false}
            animate={height === null ? undefined : { height }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: EASE }}
            onChange={(event) => {
              setInput(event.target.value)
              setError(null)
              setNeedsClaude(false)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
              event.preventDefault()
              submit()
            }}
            onPaste={(event) => {
              const files = screenshotFiles(event.clipboardData.files)
              if (files.length === 0) return
              event.preventDefault()
              takeFiles(files)
            }}
            className={`block w-full resize-none border-0 bg-transparent pr-1 pl-3 py-2.5 text-base leading-6 text-ink placeholder:text-graphite focus:ring-0 focus:outline-none ${
              scrolls ? 'overflow-y-auto' : 'overflow-hidden'
            }`}
          />
          {/* The accepted text lifts out of the box as its tiles arrive below. Decoration only. */}
          <AnimatePresence>
            {ghost && (
              <motion.div
                key={ghost.key}
                aria-hidden="true"
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                onAnimationComplete={() => setGhost(null)}
                className="pointer-events-none absolute inset-x-0 top-0 truncate pr-1 pl-3 py-2.5 text-base leading-6 text-ink"
              >
                {ghost.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {claudeConfigured && (
          <>
            <button
              type="button"
              onClick={() => picker.current?.click()}
              disabled={processing}
              aria-label="Attach a PDF or screenshot"
              title="Attach a PDF or screenshot"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-graphite hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
            >
              <Icon name="paperclip" className="size-5" />
            </button>
            <input
              ref={picker}
              type="file"
              accept={[...SCREENSHOT_TYPES, PDF_TYPE].join(',')}
              multiple
              hidden
              tabIndex={-1}
              onChange={(event) => {
                takeFiles(screenshotFiles(event.target.files))
                event.target.value = ''
              }}
            />
          </>
        )}
        <button
          type="submit"
          // Named here because the animated label inside is hidden from the linter, not from people.
          aria-label={processing ? 'Adding…' : 'Import'}
          disabled={processing || input.trim() === ''}
          className="inline-flex min-h-11 min-w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-action px-4 font-semibold text-on-action hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50 sm:min-w-28 sm:px-5"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={processing ? 'adding' : 'import'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: EASE }}
              className="inline-flex items-center gap-2"
            >
              {processing ? (
                <>
                  <span className="flex gap-1" aria-hidden="true">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className="import-dot size-1 rounded-full bg-current"
                        style={{ animationDelay: `${dot * 140}ms` }}
                      />
                    ))}
                  </span>
                  Adding…
                </>
              ) : (
                'Import'
              )}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>

      <div className="mt-2 px-1 text-sm empty:hidden">
        {problem ? (
          <p id="paste-error" role="alert" className="text-danger">
            {problem === 'needs-claude' ? (
              <>
                Reading a PDF or screenshot needs Claude.{' '}
                <Link href="/imports?mode=manual" className="underline underline-offset-4">
                  Write the recipe instead
                </Link>
                .
              </>
            ) : (
              problem
            )}
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {hint && (
              <motion.p
                id="paste-hint"
                key="hint"
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="text-graphite"
              >
                {hint}
              </motion.p>
            )}
          </AnimatePresence>
        )}
      </div>
    </form>
  )
}
