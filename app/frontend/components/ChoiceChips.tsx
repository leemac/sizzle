import FieldError from '@/components/FieldError'

/** A set of checkboxes drawn as chips, for picking any number of known options. */
export default function ChoiceChips<T extends string>({
  name,
  legend,
  hint,
  options,
  value,
  onChange,
  error,
}: {
  name: string
  legend: string
  hint?: string
  options: readonly T[]
  value: T[]
  onChange: (value: T[]) => void
  error?: string
}) {
  const toggle = (option: T, checked: boolean) =>
    onChange(options.filter((known) => (known === option ? checked : value.includes(known))))

  return (
    <fieldset
      aria-describedby={[hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(' ') || undefined}
    >
      <legend className="text-sm font-medium">
        {legend} <span className="font-normal text-graphite">(optional)</span>
      </legend>
      {hint && (
        <p id={`${name}-hint`} className="mt-1 text-sm text-graphite">
          {hint}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option} className="relative cursor-pointer">
            <input
              type="checkbox"
              name={name}
              value={option}
              checked={value.includes(option)}
              onChange={(event) => toggle(option, event.target.checked)}
              className="peer sr-only"
            />
            <span className="block rounded-full bg-paper px-3.5 py-1.5 text-sm ring-1 ring-hairline transition-colors first-letter:uppercase peer-checked:bg-yolk peer-checked:font-medium peer-checked:text-[#18181b] peer-checked:ring-yolk peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink hover:ring-ink/30">
              {option}
            </span>
          </label>
        ))}
      </div>
      <FieldError name={name} error={error} />
    </fieldset>
  )
}
