import type { Theme } from './themes'

/** The word that sets a show off: whole and case-insensitive, so not "unmerged" or "emerged". */
export const WORD = /\bmerged\b/i
/** A show's backdrop id is its theme's id plus one of these. Two of them, so a second show starts afresh. */
export const SHOW_SUFFIXES = ['--fireworks-a', '--fireworks-b'] as const
/** The backdrop of a show in a session with no theme: the bursts over a night sky of their own. */
export const NIGHT_ID = 'fireworks-night'
// No tint: with no theme standing, the panels keep the window's own colour.
export const NIGHT_GLASS = { blur: 10, opacity: 0.45 }

type Burst = { x: number; y: number; hue: number; delay: number; size: number }

// Placed at the edges and along the top so no spoke crosses the text being read. Each burst plays once and their starts stand 1s apart, which is what keeps this safe for people sensitive to flashing light.
const BURSTS: readonly Burst[] = [
  { x: 220, y: 230, hue: 48, delay: 0, size: 150 },
  { x: 1380, y: 200, hue: 330, delay: 1, size: 170 },
  { x: 800, y: 40, hue: 190, delay: 2, size: 120 },
  { x: 1470, y: 560, hue: 20, delay: 3, size: 140 },
  { x: 140, y: 620, hue: 280, delay: 4, size: 120 },
]

// Every name carries `fw` because this layer shares one document with the theme's own classes. A burst rests open so a scene the app holds still shows the bursts rather than nothing; `fw-shut` rests closed the ones that would otherwise sit on text.
const STYLE =
  '<style>' +
  '.fw-bloom{transform-box:view-box;transform:scale(1);opacity:.55;stroke-width:3;stroke-linecap:round;' +
  'animation:fw-bloom 1.7s cubic-bezier(.15,.7,.3,1) both}' +
  '.fw-bloom.fw-shut{opacity:0}' +
  '@keyframes fw-bloom{0%{transform:scale(0);opacity:0}12%{opacity:1}65%{transform:scale(1);opacity:1}' +
  '100%{transform:scale(1.12);opacity:0}}' +
  '@media (prefers-reduced-motion: reduce){.fw-bloom{animation:none;opacity:0}}' +
  '</style>'

// Picture units, 1600 wide. Place a new burst against 1210, where the three that rest open begin, not against this constant.
const WORDS_END_X = 1150

/** Whether a burst rests open when held still: its whole reach clears the words' column, panel open. */
export function restsOpen(spot: { x: number; size: number }): boolean {
  return spot.x - spot.size > WORDS_END_X
}

/**
 * One burst: spokes opening from a bright core, as a single path.
 *
 * As separate `<line>` elements the six bursts pushed the show's backdrop past what a window will draw. Coordinates are rounded to whole units.
 */
function burst(spot: Burst, lightness: number): string {
  let d = ''

  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2
    const inner = spot.size * 0.18
    const outer = spot.size * (index % 2 === 0 ? 1 : 0.72)

    d +=
      `M${Math.round(spot.x + Math.cos(angle) * inner)} ${Math.round(spot.y + Math.sin(angle) * inner)}` +
      `L${Math.round(spot.x + Math.cos(angle) * outer)} ${Math.round(spot.y + Math.sin(angle) * outer)}`
  }

  return (
    `<g class="${restsOpen(spot) ? 'fw-bloom' : 'fw-bloom fw-shut'}" style="transform-origin:${spot.x}px ${spot.y}px;` +
    `animation-delay:${spot.delay.toFixed(2)}s" stroke="hsl(${spot.hue} 95% ${lightness}%)">` +
    `<circle cx="${spot.x}" cy="${spot.y}" r="${Math.round(spot.size * 0.12)}" ` +
    `fill="hsl(${spot.hue} 100% ${lightness + 17}%)" stroke="none"/><path fill="none" d="${d}"/></g>`
  )
}

/** The bursts alone, to lay over a scene: bright over a dark one, deep over a pale one, so both read. */
function layer(window: Theme['window']): string {
  const lightness = window === 'dark' ? 68 : 40

  return STYLE + BURSTS.map(spot => burst(spot, lightness)).join('')
}

const built = new Map<string, string>()

/** A theme's scene with the bursts drawn over it, still one document, so the theme is never taken away. */
export function sceneWithFireworks(theme: Theme, scene: string): string {
  const cached = built.get(theme.id)

  if (cached !== undefined) {
    return cached
  }

  const end = scene.lastIndexOf('</svg>')
  const whole = end === -1 ? scene : scene.slice(0, end) + layer(theme.window) + '</svg>'

  built.set(theme.id, whole)

  return whole
}

/** The show of a session with no theme: the bursts over a night sky of their own. */
export function nightScene(): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="100%" height="100%" ' +
    'preserveAspectRatio="xMidYMid slice" font-family="system-ui,sans-serif" color="#e8ecff">' +
    '<defs><linearGradient id="fw-sky" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#070b1c"/><stop offset="1" stop-color="#1a1436"/></linearGradient></defs>' +
    '<rect width="1600" height="1000" fill="url(#fw-sky)"/>' +
    layer('dark') +
    '</svg>'
  )
}

/** The theme id behind a show's backdrop id, or nothing if the id is not a show's. */
export function themeIdOfShow(id: string): string | undefined {
  const suffix = SHOW_SUFFIXES.find(candidate => id.endsWith(candidate))

  return suffix === undefined ? undefined : id.slice(0, id.length - suffix.length)
}
