import type { ThemeBackdropGlass, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { mikuAeroSvg } from './scenes/miku-aero'

/** One theme: what the card and the list show, the glass over it, and a scene function returning one self-animating SVG string. */
export type Theme = {
  id: string
  title: string
  blurb: string
  /** Which window kind the scene is made for: the app uses the tint only where its own text reads on it. */
  window: 'light' | 'dark'
  /** Id of the same scene built for the other window kind, where there is one. The list and card name it. */
  twin?: string
  glass: ThemeBackdropGlass
  /** The app's own palette while this theme shows. A scene with any dark stretch needs one, or a reply is drawn straight onto it and the dark parts swallow it. Build it with `makeColors`, never by hand. */
  colors?: ThemeSetArgs['colors']
  scene: () => string
}

/** Miku Aero's palette: pale azure surfaces under deep navy text, with her own teal as the accent. */
const { theme: MIKU_AERO_COLORS } = makeColors({
  label: 'Miku Aero',
  only: 'light',
  roles: { accent: '#13a8a0', danger: '#c9394f', success: '#3f9e2c', warning: '#c8860d', pro: '#6f5fd0' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#d9ebfa',
        'surface-1': '#e9f4fd',
        // In light mode surface-2 and surface-3 must match where both are given.
        'surface-2': '#f5fbff',
        'surface-3': '#f5fbff',
        'text-primary': '#0d2537',
        'text-secondary': '#2c4a60',
        'text-muted': '#4d6b7d',
      },
    },
  },
})

export const THEMES: readonly Theme[] = [
  {
    id: 'miku-aero',
    title: 'Miku Aero',
    blurb: 'A Miku theme in Frutiger Aero style.',
    window: 'light',
    // Frosts the app's own panels, not the backdrop. Kept light because the panels carry their own colour now.
    glass: { blur: 10, tint: '#eef8ff', opacity: 0.4 },
    colors: MIKU_AERO_COLORS,
    scene: mikuAeroSvg,
  },
]

const built = new Map<string, string>()

/** Built on first use, so a session pays only for the scenes it actually shows. */
export function sceneOf(theme: Theme): string {
  const ready = built.get(theme.id)
  if (ready !== undefined) return ready
  const source = theme.scene()
  built.set(theme.id, source)
  return source
}

/** Why a theme's scene will not build, in the fault's own words, or nothing if it does. */
export function sceneFault(theme: Theme): string | undefined {
  try {
    sceneOf(theme)

    return undefined
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}
