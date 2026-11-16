// Carries a PDF or screenshots dropped on one page to the page that reads them, across an Inertia visit. The files
// stay in memory only: nothing is stored, a reload drops them, and the first page to take them empties the handoff.
let handedOff: File[] = []

export function handOffFiles(files: File[]) {
  handedOff = [...files]
}

export function takeHandedOffFiles(): File[] {
  const files = handedOff
  handedOff = []
  return files
}
