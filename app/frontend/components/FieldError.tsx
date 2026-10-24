/** Shared styling for recipe form inputs and textareas. */
export const inputClass =
  'mt-2 w-full rounded-xl border-hairline bg-paper px-4 py-3 text-base focus:border-ink focus:ring-0'

/** A field's validation message; the input points at it with aria-describedby="<name>-error". */
export default function FieldError({ name, error }: { name: string; error?: string }) {
  return error ? (
    <p id={`${name}-error`} role="alert" className="mt-2 text-sm text-danger">
      {error}
    </p>
  ) : null
}
