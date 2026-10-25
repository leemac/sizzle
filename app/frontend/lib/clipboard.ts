// navigator.clipboard only exists in secure contexts, and Sizzle is usually served over plain HTTP on a home
// network, so fall back to copying from a hidden text field.
export async function copyText(value: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Permission denied or no focus: try the fallback.
    }
  }

  const field = document.createElement('textarea')
  field.value = value
  field.readOnly = true
  field.className = 'fixed top-0 left-0 opacity-0'
  document.body.append(field)
  field.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
  }
}
