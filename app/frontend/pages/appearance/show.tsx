import { Head } from '@inertiajs/react'
import ThemePicker from '@/components/ThemePicker'
import AppLayout from '@/layouts/AppLayout'
import type { ThemeOption } from '@/types'

export default function AppearanceShow({ themes }: { themes: ThemeOption[] }) {
  return (
    <div className="mx-auto max-w-5xl">
      <Head title="Appearance" />
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">Appearance</h1>
      <p className="mt-4 max-w-xl text-graphite">
        Pick a theme, and whether Sizzle is light, dark or follows this device. It’s saved in this browser, so everyone
        in your household can have their own.
      </p>
      <div className="mt-8">
        <ThemePicker themes={themes} submitLabel="Save appearance" />
      </div>
    </div>
  )
}

AppearanceShow.layout = AppLayout
