/*
  Miku Aero: a Frutiger Aero sky drawn as pixel art, with the pixel diva standing in it. Pure string building, so the scene can be inlined with no DOM and no imports.

  Two rules here fail silently, with no error anywhere. The emitted SVG must stay under about 118KB or the window draws nothing at all, and no length may come from a custom property, `var()` or `calc()`, or the stylesheet's animations never run. Measure after any change.

  The figure below the generated marker is baked in by a generator kept outside this repository. Do not edit that section by hand, and note it is NOT under this repository's Apache licence: see NOTICE.
*/

const WIDTH = 1600
const HEIGHT = 1000

/** One cell. Every coordinate in this file is a cell index until it is multiplied by this. */
const PX = 7
const COLS = Math.ceil(WIDTH / PX)
const ROWS = Math.ceil(HEIGHT / PX)

/** Where the land meets the sky, and where it meets the water, in rows. Kept near the middle because the backdrop is sliced to cover, so a wide window keeps only a band through the centre. */
const HORIZON = 64
const SHORE = 92

const SKY = ['#063f9e', '#0b5cc4', '#147ddb', '#2a9bea', '#4bb8f3', '#71d0f8', '#9ae2fb', '#c6effd']
const GRASS = ['#ccf758', '#96e53c', '#61cb2d', '#36a522', '#1d7d18']
const SEA = ['#4ddcf4', '#1fb8ea', '#088fd0', '#0566a8', '#02467c']
/** The cloud ramp, rim to underbelly. The sun sits upper-left, so the right of every puff is a step darker. */
const CLOUD_RIM = '#ffffff'
const CLOUD_LIT = '#f2fbff'
const CLOUD_BODY = '#e2f3fe'
const CLOUD_MID = '#c3e3f6'
const CLOUD_LOW = '#9fcdec'
const CLOUD_DEEP = '#7fb4dd'
const CLOUD_RAMP = [CLOUD_RIM, CLOUD_LIT, CLOUD_BODY, CLOUD_MID, CLOUD_LOW, CLOUD_DEEP] as const
const FOAM = '#e8fbff'
const RIM = '#dff6ff'


/** Deterministic scatter: the same sky every launch, so the theme does not shuffle under the user. */
function roller(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

/**
 * Paint registry. Each distinct fill, opacity and height gets a two-character class rather than repeated attributes.
 *
 * `paintCss` must be read after the body is built, or the registry will still be empty.
 */
const paints = new Map<string, string>()

function paint(fill: string, opacity: number | undefined, height: number): string {
  // Quantised to a twentieth, and the leading zero dropped, since CSS reads `.35` the same as `0.35`.
  const step = opacity === undefined ? '' : (Math.round(opacity * 20) / 20).toString().replace('0.', '.')
  const key = `${fill}|${step}|${height}`
  const had = paints.get(key)
  if (had !== undefined) return had
  // The dash is load-bearing: no hand-written class here has one, so a generated name can never collide.
  const name = `p-${paints.size.toString(36)}`
  paints.set(key, name)
  return name
}

/** The class rules for every paint the body asked for, newline-free to keep the style block tight. */
function paintCss(): string {
  let css = ''
  for (const [key, name] of paints) {
    const [fill, step, height] = key.split('|')
    css += `.${name}{fill:${fill};height:${height}px${step === '' ? '' : `;fill-opacity:${step}`}}`
  }
  return css
}

/** The same trick as `paint`, for per-element animation timings. Interning only pays when timings collide, so durations and delays are quantised before they are keyed. */
const rules = new Map<string, string>()

function styled(css: string): string {
  const had = rules.get(css)
  if (had !== undefined) return had
  const name = `s-${rules.size.toString(36)}`
  rules.set(css, name)
  return name
}

/** Whole-second steps, so a hundred random durations collapse to a couple of dozen rules. */
function beat(secs: number): string {
  return String(Math.max(1, Math.round(secs)))
}

function ruleCss(): string {
  let css = ''
  for (const [body, name] of rules) css += `.${name}{${body}}`
  return css
}

/** Drift and bob keyframes, one per distinct distance. Every length is a LITERAL: a custom property with `calc()` renders the colours and then silently runs none of the stylesheet's animations. */
const motions = new Map<string, string>()

function swing(axis: 'x' | 'y', amount: number): string {
  const key = `${axis}${amount}`
  const had = motions.get(key)
  if (had !== undefined) return had
  const name = `m-${motions.size.toString(36)}`
  motions.set(key, name)
  return name
}

function motionCss(): string {
  let css = ''
  for (const [key, name] of motions) {
    const amount = key.slice(1)
    css +=
      (key[0] === 'x'
        ? `@keyframes k${name}{from{transform:translateX(-${amount}px)}to{transform:translateX(${amount}px)}}`
        : `@keyframes k${name}{from{transform:translateY(0)}to{transform:translateY(-${amount}px)}}`) +
      `.${name}{animation-name:k${name};animation-iteration-count:infinite;animation-direction:alternate}`
  }
  return css
}

function run(col: number, row: number, len: number, fill: string, opacity?: number): string {
  if (len <= 0) return ''
  return `<rect x="${col}" y="${row}" width="${len}" class="${paint(fill, opacity, 1)}"/>`
}

function block(col: number, row: number, w: number, h: number, fill: string, opacity?: number): string {
  return `<rect x="${col}" y="${row}" width="${w}" class="${paint(fill, opacity, h)}"/>`
}

function ditherId(fill: string): string {
  return `d${fill.slice(1)}`
}

/** The checker tiles that carry every gradient seam. Each is two cells square: `h` fills two of the four, `q` one. A band fading into the next lays q then h instead of meeting it at a hard edge. */
function ditherDefs(): string {
  const seen = new Set<string>()
  let out = ''
  for (const fill of [...SKY, ...GRASS, ...SEA, CLOUD_MID, FOAM]) {
    const id = ditherId(fill)
    if (seen.has(id)) continue
    seen.add(id)
    out +=
      `<pattern id="${id}h" width="2" height="2" patternUnits="userSpaceOnUse">` +
      `<rect width="1" height="1" fill="${fill}"/>` +
      `<rect x="1" y="1" width="1" height="1" fill="${fill}"/></pattern>` +
      `<pattern id="${id}q" width="2" height="2" patternUnits="userSpaceOnUse">` +
      `<rect width="1" height="1" fill="${fill}"/></pattern>`
  }
  return out
}

/** A vertical ramp through a palette, each step meeting the next through two rows of checker. */
function ramp(row0: number, row1: number, palette: readonly string[]): string {
  const span = (row1 - row0) / palette.length
  let out = ''
  for (let i = 0; i < palette.length; i++) {
    const top = Math.round(row0 + i * span)
    const bottom = i === palette.length - 1 ? row1 : Math.round(row0 + (i + 1) * span)
    out += block(0, top, COLS, bottom - top, palette[i] as string)
    if (i + 1 < palette.length) {
      const next = ditherId(palette[i + 1] as string)
      out += `<rect x="0" y="${(bottom - 4)}" width="${COLS}" height="2" fill="url(#${next}q)"/>`
      out += `<rect x="0" y="${(bottom - 2)}" width="${COLS}" height="2" fill="url(#${next}h)"/>`
    }
  }
  return out
}

function sky(): string {
  return ramp(0, HORIZON + 1, SKY)
}

/** Sun high on the left, over the reading column: a disc, a dithered corona, and a few blunt rays. */
function sun(): string {
  const cx = 33
  const cy = 18
  let out = ''
  for (let dy = -16; dy <= 16; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, 256 - dy * dy)))
    out += run(cx - half, cy + dy, half * 2 + 1, '#ffffff', 0.26)
  }
  for (let dy = -11; dy <= 11; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, 121 - dy * dy)))
    out += run(cx - half, cy + dy, half * 2 + 1, '#ffffff')
  }
  const spokes: Array<readonly [number, number, number]> = [
    [1, 0, 30], [-1, 0, 24], [0, 1, 26], [0, -1, 17], [1, 1, 23], [-1, 1, 20], [1, -1, 19],
  ]
  for (const [dx, dy, len] of spokes) {
    for (let i = 13; i < len; i++) {
      out += block(cx + dx * i, cy + dy * i, 1, 1, '#ffffff', Math.max(0.05, 0.36 - i * 0.012))
    }
  }
  return out
}

/** A cumulus, shaded rather than outlined: nine overlapping ellipses, each cell toned by how far it sits below the cloud's own top surface in that column, a step darker to the right, blue along the bottom. */
function cloud(cx: number, cy: number, w: number, seed: number): string {
  const rand = roller(seed)
  const blobs: Array<readonly [number, number, number, number]> = []
  for (let i = 0; i < 11; i++) {
    const t = i / 10 - 0.5
    const bx = cx + Math.round(t * w * 1.7 + (rand() - 0.5) * w * 0.2)
    const by = cy + Math.round(Math.abs(t) * w * 0.26 + (rand() - 0.5) * w * 0.3)
    const rx = Math.max(2, Math.round(w * (0.26 - Math.abs(t) * 0.18) * (0.55 + rand() * 0.95)))
    const ry = Math.max(2, Math.round(rx * (0.55 + rand() * 0.5)))
    blobs.push([bx, by, rx, ry] as const)
  }
  const top = Math.min(...blobs.map(([, by, , ry]) => by - ry))
  const bottom = Math.max(...blobs.map(([, by, , ry]) => by + ry))
  const left = Math.min(...blobs.map(([bx, , rx]) => bx - rx))
  const right = Math.max(...blobs.map(([bx, , rx]) => bx + rx))
  const width = right - left + 1
  const height = bottom - top + 1
  const covered = (col: number, row: number) =>
    blobs.some(([bx, by, rx, ry]) => ((col - bx) / rx) ** 2 + ((row - by) / ry) ** 2 <= 1)
  // The top surface per column, so a puff tucked behind another still gets its own lit cap.
  const crown: number[] = []
  const floor: number[] = []
  for (let c = 0; c < width; c++) {
    let first = -1
    let last = -1
    for (let r = 0; r < height; r++) {
      if (!covered(left + c, top + r)) continue
      if (first < 0) first = r
      last = r
    }
    crown.push(first)
    floor.push(last)
  }
  // Read the top surface in steps of four columns, never column by column: per-column each row shatters into five or six runs, which took the clouds past what the window will draw.
  const STEP = 3
  for (let c = 0; c < width; c++) {
    const base = Math.min(width - 1, Math.floor(c / STEP) * STEP)
    if (crown[c]! >= 0 && crown[base]! >= 0) crown[c] = crown[base]!
  }
  // A cell of jitter per tread, carried across the whole tread so the runs still merge.
  for (let c = 0; c < width; c += STEP) {
    const nudge = rand() < 0.45 ? 1 : 0
    for (let k = c; k < Math.min(width, c + STEP); k++) {
      if (crown[k]! > 0) crown[k] = crown[k]! + nudge
    }
  }
  let out = ''
  for (let r = 0; r < height; r++) {
    let runStart = -1
    let runTone = -1
    const flush = (end: number) => {
      if (runStart < 0) return
      out += run(left + runStart, top + r, end - runStart, CLOUD_RAMP[runTone] as string)
      runStart = -1
    }
    for (let c = 0; c <= width; c++) {
      let tone = -1
      if (c < width && crown[c]! >= 0 && r >= crown[c]! && r <= floor[c]!) {
        const below = r - crown[c]!
        const above = floor[c]! - r
        tone = below === 0 ? 0 : below <= 2 ? 1 : 2
        // Only two tone boundaries, the shade break and the underside: each extra one splits every row it crosses into another run, and runs are what this scene pays for.
        if (tone === 2 && c > width * (0.52 + 0.14 * Math.sin(r * 0.8 + seed))) tone = 3
        if (above <= 1) tone = Math.max(tone, 4)
      }
      if (tone !== runTone) {
        flush(c)
        runTone = tone
        runStart = tone < 0 ? -1 : c
      }
    }
    flush(width)
  }
  return out
}

/** The thin drawn-out clouds along the horizon. One or two rows each, so they cost almost nothing. */
function streaks(): string {
  const rand = roller(911)
  let out = ''
  for (let i = 0; i < 20; i++) {
    const row = HORIZON - 22 + Math.floor(rand() * 20)
    const col = Math.floor(rand() * (COLS - 14))
    const len = 4 + Math.floor(rand() * 16)
    const pale = rand() < 0.5
    out += run(col, row, len, pale ? CLOUD_LIT : CLOUD_BODY, 0.75)
    if (len > 9) out += run(col + 2, row + 1, len - 5, CLOUD_MID, 0.6)
  }
  return out
}

function clouds(): string {
  const bank: Array<readonly [number, number, number, number, number, number]> = [
    [26, 36, 30, 7, 74, 14], [100, 27, 24, 23, 96, 12], [169, 39, 34, 41, 62, 16],
    [209, 21, 20, 59, 110, 10],
  ]
  let out = ''
  for (const [cx, cy, w, seed, secs, step] of bank) {
    out +=
      `<g class="${swing('x', step * 2)} ${styled(`animation-duration:${beat(secs)}s;animation-timing-function:steps(${step})`)}">` +
      cloud(cx, cy, w, seed) +
      '</g>'
  }
  return out
}

/** Land: a low rise stepped onto the grid, run-length encoded so a flat stretch costs one rect. */
function land(): string {
  const tops: number[] = []
  for (let col = 0; col < COLS; col++) {
    const t = col / COLS
    const rise = Math.sin(t * 5.1 + 0.6) * 2.4 + Math.sin(t * 2.2 + 2.1) * 3.1
    tops.push(HORIZON - Math.round(rise))
  }
  let out = ''
  let start = 0
  for (let col = 1; col <= COLS; col++) {
    if (col === COLS || tops[col] !== tops[start]) {
      const top = tops[start] as number
      out += block(start, top, col - start, SHORE - top + 1, GRASS[2] as string)
      out += block(start, top, col - start, 2, GRASS[0] as string)
      out += block(start, top + 2, col - start, 2, GRASS[1] as string)
      start = col
    }
  }
  const tex = roller(1307)
  for (let i = 0; i < 34; i++) {
    const col = Math.floor(tex() * (COLS - 6))
    const row = HORIZON + 2 + Math.floor(tex() * Math.max(1, SHORE - HORIZON - 4))
    const len = 2 + Math.floor(tex() * 5)
    out += run(col, row, len, (tex() < 0.5 ? GRASS[3] : GRASS[0]) as string, 0.3 + tex() * 0.3)
  }
  const deep = ditherId(GRASS[3] as string)
  // Two passes, wide and gentle plus narrow and steep, with dithered rows where the steps would show. One pass alone read as a printed gradient ruled across the grass.
  const BANK = 24
  for (let d = 0; d < BANK; d++) {
    const row = SHORE - 1 - d
    const fall = Math.pow(1 - d / BANK, 2.6)
    out += block(0, row, COLS, 1, GRASS[4] as string, Math.min(0.92, fall * 1.05))
  }
  const EDGE = 9
  for (let d = 0; d < EDGE; d++) {
    const row = SHORE - 1 - d
    const fall = Math.pow(1 - d / EDGE, 3.4)
    out += block(0, row, COLS, 1, '#06290b', Math.min(0.9, fall * 0.95))
  }
  out += `<rect x="0" y="${SHORE - BANK - 2}" width="${COLS}" height="2" fill="url(#${deep}q)"/>`
  out += `<rect x="0" y="${SHORE - BANK}" width="${COLS}" height="2" fill="url(#${deep}h)"/>`
  return out
}

/** Water: banded sea, a foam line at the bank, scattered ripple runs and the sun's glint. */
function water(): string {
  const rand = roller(97)
  let out = ramp(SHORE, ROWS, SEA)
  out += block(0, SHORE, COLS, 1, FOAM)
  out += block(0, SHORE + 1, COLS, 1, FOAM, 0.35)
  // What stands on the bank, smeared into the shallows below it.
  for (let i = 0; i < 22; i++) {
    const col = Math.floor(rand() * COLS)
    const deep = 2 + Math.floor(rand() * 4)
    for (let d = 0; d < deep; d++) {
      if (rand() < 0.25) continue
      out += run(col, SHORE + 2 + d, 1 + Math.floor(rand() * 2), '#2f8f24', 0.3 - d * 0.04)
    }
  }

  // Specular glitter, laid out per row with a falloff rather than scattered over the surface. Collected into buckets so each gets one group with its own fade, rather than animating two hundred dashes apiece.
  const RIPPLES = 6
  const buckets: string[] = Array.from({ length: RIPPLES }, () => '')
  for (let row = SHORE + 2; row < ROWS; row++) {
    const t = (row - SHORE) / (ROWS - SHORE)
    // Some rows get none: a dash on every row read as a grid once the rows breathed at different times.
    const dashes = Math.floor(rand() * (1.4 + t * 3.2))
    for (let k = 0; k < dashes; k++) {
      const col = Math.floor(rand() * COLS)
      const len = 1 + Math.floor(rand() * (2 + t * 7))
      const away = Math.abs(col - 33) / COLS
      // Neighbours land in different buckets on purpose, or a whole band would brighten at once.
      const into = Math.floor(rand() * RIPPLES)
      buckets[into] += run(col, row, len, RIM, Math.max(0.12, (0.85 - away * 0.95) * (0.4 + rand() * 0.75)))
    }
    if (row % 6 === 2) {
      const col = Math.floor(rand() * (COLS - 30))
      out += run(col, row, 14 + Math.floor(rand() * 26), SEA[4] as string, 0.22 + rand() * 0.16)
    }
  }

  for (let i = 0; i < RIPPLES; i++) {
    out +=
      `<g class="ripple rp${i % 3} ${styled(`animation-duration:${beat(5 + i * 2.2)}s;animation-delay:-${beat(i * 1.7)}s`)}">` +
      buckets[i] +
      '</g>'
  }

  // The near corners sink towards black on a radial ramp, deliberately not on the pixel grid: banding a falloff is what makes it look drawn rather than lit.
  for (const [id, cx] of [
    ['vl', 0],
    ['vr', COLS],
  ] as const) {
    out +=
      `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${ROWS}" r="74">` +
      '<stop offset="0" stop-color="#000710" stop-opacity="0.76"/>' +
      '<stop offset="0.3" stop-color="#011b31" stop-opacity="0.5"/>' +
      '<stop offset="0.62" stop-color="#03365f" stop-opacity="0.22"/>' +
      '<stop offset="1" stop-color="#04335c" stop-opacity="0"/></radialGradient>' +
      // Clipped to the water: the gradient reaches wider than the water is deep, so a square anchored on the corner took a bite of shade out of the grass.
      `<rect x="${cx === 0 ? 0 : COLS - 74}" y="${SHORE}" width="74" height="${ROWS - SHORE}" fill="url(#${id})"/>`
  }

  for (let row = SHORE + 1; row < ROWS; row++) {
    const t = (row - SHORE) / (ROWS - SHORE)
    const half = Math.max(1, Math.round((2 + t * 13) * (0.45 + rand() * 0.8)))
    const col = 33 - half + Math.round((rand() - 0.5) * 8 * t)
    out += run(col, row, half * 2, '#ffffff', Math.max(0.08, (0.6 - t * 0.34) * (0.5 + rand() * 0.7)))
  }
  return out
}

/** Her shadow on the water: a broad, shallow smear under her legs, reaching further out than it is deep. */
function shadow(): string {
  const rand = roller(3109)
  // Set well to her left: centred under her it lay entirely behind her own twintails.
  const cx = FIG_COL + 8
  const top = SHORE + 4
  let out = ''
  for (let row = top; row < ROWS; row++) {
    const t = (row - top) / (ROWS - top)
    // Widest just below her, tapering as it runs away toward the viewer.
    const half = Math.round(46 * Math.sqrt(Math.max(0, 1 - (t - 0.15) ** 2 * 1.7)) + rand() * 5)
    if (half < 3) continue
    const drift = Math.round((rand() - 0.5) * 4 - t * 14)
    out += run(cx - half + drift, row, half * 2, '#063f6e', Math.max(0.08, 0.46 - t * 0.3))
    // A denser core right under her, so the shadow has a root rather than floating as a flat wash.
    if (t < 0.55) {
      const core = Math.max(2, Math.round(half * 0.4))
      out += run(cx - core + drift, row, core * 2, '#042c52', Math.max(0.06, 0.38 - t * 0.4))
    }
  }
  return out
}

/** Sunlight raking up across the near corner, drawn last over everything, each shaft on its own clock. Each shaft is one staircase path: as a stack of rows it pushed the scene past what the window will draw. */
function shafts(): string {
  const rand = roller(4421)
  const STEP = 2
  let out = ''
  for (let i = 0; i < 13; i++) {
    const foot = COLS - 1 - Math.floor(rand() * 74)
    const lean = 0.5 + rand() * 0.45
    // Narrow. Wide shafts turned the near corner into one pale wedge and buried her legs in it; thin ones read as light and leave the picture underneath alone.
    const wide = 2 + Math.floor(rand() * 4)
    const reach = 22 + Math.floor(rand() * 26)
    const edge = (k: number) => Math.round(foot - k * lean)
    const rowAt = (k: number) => ROWS - k
    // Down the left edge in steps, then back up the right one. The shaft narrows as it climbs.
    const span = (k: number) => Math.max(1, Math.round(wide * (1 - k / reach)))
    let d = `M${edge(reach)} ${rowAt(reach)}`
    for (let k = reach - STEP; k >= 0; k -= STEP) d += `V${rowAt(k)}H${edge(k)}`
    d += `V${rowAt(0)}H${edge(0) + span(0)}`
    for (let k = STEP; k <= reach; k += STEP) d += `V${rowAt(k)}H${edge(k) + span(k)}`
    out +=
      `<g class="beam ${styled(`animation-duration:${beat(6 + rand() * 7)}s;animation-delay:-${beat(rand() * 7)}s`)}">` +
      `<path d="${d}Z" fill="#ffffff" fill-opacity="${(0.16 + rand() * 0.14).toFixed(2)}"/></g>`
  }
  return out
}


/** A pixel bubble: a one-cell rim, a faint interior, and the two-cell glint that keeps it from reading as a ring. */
function bubble(cx: number, cy: number, r: number, secs: number, lift: number, step: number): string {
  let out = ''
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)))
    if (half === 0) continue
    out += run(cx - half, cy + dy, half * 2 + 1, RIM, 0.14)
    if (Math.abs(dy) >= r - 1) {
      out += run(cx - half, cy + dy, half * 2 + 1, RIM, 0.85)
    } else {
      out += run(cx - half, cy + dy, 1, RIM, 0.85)
      out += run(cx + half, cy + dy, 1, RIM, 0.85)
    }
  }
  const gx = cx - Math.round(r * 0.5)
  const gy = cy - Math.round(r * 0.52)
  out += block(gx, gy, 2, 1, '#ffffff')
  out += block(gx, gy + 1, 1, 1, '#ffffff')
  return (
    `<g class="${swing('y', lift)} ${styled(`animation-duration:${beat(secs)}s;animation-timing-function:steps(${step})`)}">` +
    out +
    '</g>'
  )
}

function bubbles(): string {
  const set: Array<readonly [number, number, number, number, number, number]> = [
    // Six, not eight. A bubble costs about thirty shapes and the water needed the budget more.
    [199, 43, 9, 13, 9, 9], [169, 89, 6, 10, 7, 7], [217, 109, 7, 15, 10, 10],
    [109, 92, 7, 12, 8, 8], [127, 120, 5, 10, 7, 7],
  ]
  let out = ''
  for (const [cx, cy, r, secs, lift, step] of set) out += bubble(cx, cy, r, secs, lift, step)
  return out
}

/** Single bright cells through the air and the water. */
function sparkles(): string {
  const rand = roller(313)
  let out = ''
  for (let i = 0; i < 30; i++) {
    out +=
      `<rect x="${Math.floor(rand() * COLS)}" y="${Math.floor(rand() * ROWS)}" width="1" ` +
      `class="twinkle ${paint('#ffffff', 0.35 + rand() * 0.5, 1)} ` +
      `${styled(`animation-duration:${beat(3 + rand() * 5)}s;animation-delay:-${beat(rand() * 6)}s`)}"/>`
  }
  return out
}

/** The wash over the reading column. Stepped like everything else, so it adds no soft edge back. */
function veil(): string {
  const w = Math.round(COLS * 0.075)
  let out = ''
  for (let i = 0; i < 9; i++) {
    // Half what it was: the app lays its own glass over this, and the two together washed the scene flat.
    out += block(i * w, 0, w, ROWS, '#f2fbff', Math.max(0, 0.24 - i * 0.029))
  }
  return out
}


/** The airbrushed glow behind her, so she does not dissolve into the sky. A radial gradient, deliberately off the pixel grid like the corner falloffs: as dotted rows it cost 47KB on its own. */
function halo(): string {
  return (
    '<radialGradient id="hl"><stop offset="0" stop-color="#ffffff" stop-opacity="0.42"/>' +
    '<stop offset="0.38" stop-color="#f2fbff" stop-opacity="0.3"/>' +
    '<stop offset="0.68" stop-color="#c6ebff" stop-opacity="0.19"/>' +
    '<stop offset="1" stop-color="#a8ddff" stop-opacity="0"/></radialGradient>' +
    `<ellipse cx="163" cy="76" rx="${Math.round(70 * 0.78)}" ry="70" fill="url(#hl)"/>`
  )
}

/** The goldfish, in the shape it had before: a compact body with one flicking tail, nose at the left. */
const FISH_BODY = '#ff7a1a'
const FISH_LIT = '#ffb15c'
const FISH_DEEP = '#e04f00'
const FISH_FIN = '#ffc98a'

function goldfish(): string {
  const body: Array<readonly [number, number, number, string]> = [
    [3, 0, 3, FISH_FIN], [2, 1, 5, FISH_LIT], [1, 2, 8, FISH_LIT],
    [0, 3, 10, FISH_BODY], [0, 4, 10, FISH_BODY], [0, 5, 9, FISH_DEEP],
    [1, 6, 6, FISH_DEEP], [3, 7, 3, FISH_FIN],
  ]
  let out = ''
  for (const [col, row, len, fill] of body) out += run(col, row, len, fill)
  out += run(1, 3, 1, '#1b1b1b')
  out += run(1, 2, 2, '#ffffff', 0.6)

  let tail = ''
  for (const [col, row, len, fill] of [[9, 2, 3, FISH_FIN], [9, 3, 3, FISH_LIT], [9, 4, 3, FISH_LIT], [9, 5, 3, FISH_FIN]] as const) {
    tail += run(col, row, len, fill)
  }
  return out + `<g class="tailflick">${tail}</g>`
}

/**
 * The near fish, patrolling the water in front of her at about one cell a second.
 *
 * A closed loop: it ends the cycle in exactly the pose it starts in, so the repeat cannot be seen. Keep it that way.
 */
function nearFish(): string {
  return (
    '<g class="approach" style="animation-duration:58s">' +
    `<g transform="translate(95 66)">${goldfish()}</g>` +
    '</g>'
  )
}

/** One more off to the left, holding its distance: it only wanders, it never comes near. */
function farFish(): string {
  return (
    '<g class="roam" style="animation-duration:70s">' +
    `<g transform="translate(62 62) scale(0.7)">${goldfish()}</g>` +
    '</g>'
  )
}

/** Cross-shaped glints, the lens-flare kind, drawn over the figure as well as behind her on purpose. */
function flares(): string {
  const rand = roller(1013)
  let out = ''
  for (let i = 0; i < 13; i++) {
    const col = Math.floor(rand() * COLS)
    const row = Math.floor(rand() * (ROWS - 20))
    const arm = 2 + Math.floor(rand() * 4)
    const alpha = 0.4 + rand() * 0.5
    let star = block(-arm, 0, arm * 2 + 1, 1, '#ffffff', alpha * 0.55)
    star += block(0, -arm, 1, arm * 2 + 1, '#ffffff', alpha * 0.55)
    star += block(-1, 0, 3, 1, '#ffffff', alpha)
    star += block(0, -1, 1, 3, '#ffffff', alpha)
    star += block(0, 0, 1, 1, '#ffffff')
    if (arm > 3) {
      star += block(-1, -1, 1, 1, '#d8f4ff', alpha * 0.5)
      star += block(1, 1, 1, 1, '#d8f4ff', alpha * 0.5)
    }
    out +=
      `<g class="pulse ${styled(`animation-duration:${beat(2.2 + rand() * 3)}s;animation-delay:-${beat(rand() * 4)}s`)}">` +
      `<g transform="translate(${col} ${row})">${star}</g></g>`
  }
  return out
}



/** Islets far out on the water, each with the smear of its own reflection under it. */
function rocks(): string {
  const rand = roller(199)
  let out = ''
  for (let i = 0; i < 5; i++) {
    const col = Math.floor(rand() * COLS)
    const row = SHORE + 1 + Math.floor(rand() * 6)
    const w = 3 + Math.floor(rand() * 6)
    const h = 1 + Math.floor(rand() * 2)
    for (let k = 0; k < h; k++) out += run(col + k, row - k, w - k * 2, k === h - 1 ? '#7f9099' : '#4e5d66')
    out += run(col, row + 1, w, '#2a5f86', 0.5)
    out += run(col + 1, row + 2, w - 2, '#2a5f86', 0.28)
  }
  return out
}



/** Dew on the lens: a bright cell with a darker rim under it, scattered and still. */
function droplets(): string {
  const rand = roller(571)
  let out = ''
  for (let i = 0; i < 14; i++) {
    // Kept clear of the figure: these are drawn after her, so a drop on her skirt read as damage to the sprite rather than water on the lens.
    const col = Math.floor(rand() * (FIG_COL - 6))
    const row = Math.floor(rand() * ROWS)
    const r = 1 + Math.floor(rand() * 2)
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)))
      out += run(col - half, row + dy, half * 2 + 1, '#ffffff', 0.22)
    }
    out += run(col - r, row + r, r * 2 + 1, '#bfe9ff', 0.5)
    out += run(col - 1, row - r, 1, '#ffffff', 0.95)
  }
  return out
}

// The figure data below is an adaptation of Hatsune Miku, (C) Crypton Future Media, Inc. 2007, licensed CC BY-NC 3.0 (https://creativecommons.org/licenses/by-nc/3.0/), NOT Apache-2.0 like the rest of this file. Non-commercial only. Based on a work at https://piapro.net/license. See NOTICE. Keep this note ABOVE the marker: the generator overwrites everything below it.

// ---- generated figure section: everything below is written by the figure generator ----

/**
 * The figure, as cells on the same grid as the sky. The removebg export is sampled onto a 91x137 grid by
 * tools/pixelate.py, and every cell of a group rides in one path, so the figure costs 70 nodes.
 *
 * Hair cells are banded by how far they sit from where the hair gathers at the crown, so a band swings hard
 * at the tips and barely at the roots. Every band shares one period and only its start is staggered, which
 * sends a wave down the hair; different periods let bands drift out of step and tear it into loose squares.
 * The skirt hem, tie, sleeve and boot trim are not hair and hold still while it moves.
 */
const GRID_W = 91
const GRID_H = 137

/** She hangs off the bottom of the sheet on purpose: cropping her boots buys the head and tails their size. */
const FIG_COL = 129
const FIG_ROW = 13

const BANDS = 14
const SWEEP = 5.5
const LEAD = 0.1
const REACH = 8

/**
 * Cells per group: the flutter class, the cell's own tone, then two base-36 chars per coordinate
 * (column, row, column, row). Tone is baked per cell rather than painted as a gradient over the figure,
 * so each square keeps one flat colour and the pixels stay pixels while they move.
 */
const PIXELS: Array<[string, string, string]> = [
  ['h00', '#0f6d66', '1700180019001a001b001c001d001e0015011601'],
  ['h00', '#20bcae', '1a061b061c06150716071707180719071a071b071c071d0713081408150816081708180819081a081b081c081d0813091409150916091709180919091a091b091c091d09140a150a190a1a0a1b0a1c0a1b0b'],
  ['h00', '#3fe0d0', '1g001h001i001j0014011e011f011g011k01120213021d021e021f021l02100311031c031d031e031f031k031l031m031a041b041c041d041e041f041j041k041l041m041705180519051a051b051c051d051e051f051g051i051j051k051l051m0513061406150616061706180619061d061e061f061h061k061l061m0611071207130714071e071f071g071j071k071l071m071008110812081e081f081g081h081i081j081k081l081m081009110912091e091f091g091h091i091j091k091l091m09100a110a120a130a160a170a180a1d0a1e0a1f0a1g0a1h0a1i0a1j0a1k0a1l0a1m0a100b110b120b130b140b150b160b170b180b190b1a0b1c0b1d0b1e0b1f0b1g0b1h0b1i0b1j0b1k0b1l0b1m0b100c110c120c130c140c150c160c170c180c190c1a0c1b0c1c0c1d0c1e0c1f0c1g0c1h0c1i0c1k0c1l0c1m0c110d120d130d140d150d160d170d180d190d1a0d1b0d1c0d1d0d1e0d1f0d1g0d1h0d1i0d1j0d1k0d1l0d1m0d110e120e130e140e150e160e180e190e1a0e1b0e1c0e1d0e1e0e1f0e1g0e1h0e1i0e120f130f140f150f160f170f180f190f1a0f1b0f1c0f1d0f1e0f1f0f1g0f1h0f130g140g150g160g170g180g190g1a0g1b0g1c0g1d0g1e0g1f0g1g0g1h0g1i0g180h190h1a0h1b0h1d0h1e0h1f0h1g0h1h0h1i0h190i1a0i1b0i1c0i1d0i1e0i1f0i1g0i1h0i'],
  ['h00', '#7bf5e6', '1701180119011a011b011c011d011h011i011j011402150216021702180219021a021b021c021g021h021i021j021k02120313031403150316031703180319031a031b031g031h031i031j0310041104120413041404150416041704180419041g041h041i0410051105120513051405150516051h051006110612061g061i061j0610071h071i071j0c1c0h'],
  ['h01', '#0f6d66', '1i001j0014011k01120213021l021m031m041n050y061o060x071o070x081p080w091p090w0a1q0a0w0b1r0b0v0c1r0c0v0d1s0d1k0e1j0f1k0f1i0g1k0g1i0h1l0h1h0i1l0i1g0j1l0j1g0k1l0k140l1h0l1f0m1h0m1g0n'],
  ['h01', '#20bcae', '150716071308140815081608130914091509140a150a110h100i110i120i0z0j100j110j120j0y0k0z0k100k110k120k130k0y0l0z0l100l110l120l130l0x0m0y0m0z0m100m120m130m0x0n0y0n0z0n130n0y0o0z0o'],
  ['h01', '#3fe0d0', '17001e001g001h00150116011e011f011g011e021f02100311031e031f031k031l030z041e041f041j041k041l040z0517051f051g051i051j051k051l051m05130614061506160617061h061k061l061m061n0611071207130714071g071j071k071l071m071n071008110812081g081h081i081j081k081l081m081n081o081009110912091g091h091i091j091k091l091m091n091o090z0a100a110a120a130a1g0a1h0a1i0a1j0a1k0a1l0a1m0a1n0a1o0a1p0a0z0b100b110b120b130b140b150b1g0b1h0b1i0b1j0b1k0b1l0b1m0b1n0b1o0b1p0b1q0b0z0c100c110c120c130c140c150c1g0c1h0c1i0c1k0c1l0c1m0c1n0c1o0c1p0c1q0c0z0d100d110d120d130d140d150d1a0d1b0d1c0d1d0d1e0d1f0d1g0d1h0d1i0d1j0d1k0d1l0d1m0d1n0d1o0d1p0d1q0d1r0d0v0e0z0e100e110e120e130e140e150e190e1a0e1b0e1c0e1d0e1e0e1f0e1g0e1h0e1i0e1j0e1l0e1m0e1n0e1o0e1p0e1q0e1r0e1s0e0u0f0z0f100f110f120f130f140f150f190f1a0f1b0f1c0f1d0f1e0f1f0f1g0f1h0f1l0f1m0f1n0f1o0f1p0f1q0f1r0f1s0f1t0f0u0g0y0g0z0g100g110g120g130g140g150g160g190g1a0g1b0g1c0g1d0g1e0g1f0g1g0g1h0g1m0g1n0g1o0g1p0g1q0g1r0g1s0g1t0g0u0h0y0h0z0h100h120h130h140h150h160h190h1a0h1b0h1d0h1e0h1f0h1g0h1h0h1n0h1o0h1p0h1q0h1r0h1s0h1t0h0t0i0y0i0z0i130i140i150i160i170i190i1a0i1b0i1c0i1d0i1e0i1f0i1g0i1o0i1p0i1q0i1r0i1s0i1t0i0x0j0y0j130j140j150j160j170j190j1a0j1b0j1c0j1d0j1e0j1f0j1o0j1p0j1q0j1r0j1s0j0x0k140k150k160k170k190k1a0k1b0k1c0k1d0k1e0k1f0k1o0k1p0k1q0k1r0k1s0k0w0l0x0l150l160l170l190l1a0l1b0l1c0l1d0l1e0l1f0l1g0l1m0l1o0l1p0l1q0l1r0l0w0m110m140m150m190m1a0m1b0m1c0m1d0m1e0m1g0m1m0m1p0m1q0m100n120n140n150n190n1a0n1b0n1c0n1d0n1e0n1f0n1m0n1p0n100o130o170o190o1a0o1b0o1c0o1d0o1e0o1f0o1g0o100p160p1c0p1d0p1e0p1f0p1g0p1h0p1i0p1d0q1e0q1f0q1g0q1h0q1i0q1j0q'],
  ['h01', '#7bf5e6', '17011h011i011j0114021502160217021g021h021i021j021k021203130314031503160317031g031h031i031j03100411041204130414041504160417041g041h041i0410051105120513051405150516051h050z061006110612061g061i061j060y070z0710071h071i070y080z080x090y090z090x0a0y0a0x0b0y0b0w0c0x0c0y0c1j0c0w0d0x0d0y0d0w0e0x0e0y0e0v0f0w0f0x0f0y0f0v0g0w0g0x0g1l0g0v0h0w0h0x0h1c0h1m0h0u0i0v0i0w0i0x0i1m0i1n0i0u0j0v0j0w0j1m0j1n0j0v0k0w0k1m0k1n0k0v0l1n0l1n0m1o0m1n0n1o0n'],
  ['h02', '#0f6d66', '0v0e1s0e0u0f1t0f0u0g1t0g0u0h1u0h0t0i1v0i0t0j1v0j0t0k1w0k0s0l1m0l0s0m110m1m0m0s0n100n120n140n1m0n0r0o100o130o1m0o100p1n0p100q1n0q100r1n0r100s1n0s'],
  ['h02', '#20bcae', '110h100i110i120i0z0j100j110j120j0y0k0z0k100k110k120k130k0y0l0z0l100l110l120l130l0x0m0y0m0z0m100m120m130m0x0n0y0n0z0n130n0x0o0y0o0z0o0x0p0y0p0z0p0x0q0y0q0z0q0w0r0x0r0y0r0z0r1u0r1v0r0w0s0x0s0y0s0z0s1u0s1v0s1w0s0w0t0x0t0y0t0z0t1u0t1v0t0v0u0w0u0x0u0y0u0z0u0v0v0w0v0x0v0y0v0z0v0v0w0w0w0x0w0y0w0z0w'],
  ['h02', '#3fe0d0', '0w0b1o0b1p0b1q0b1r0b0v0c1o0c1p0c1q0c1r0c0v0d0z0d1n0d1o0d1p0d1q0d1r0d1s0d0z0e100e1n0e1o0e1p0e1q0e1r0e0z0f100f1m0f1n0f1o0f1p0f1q0f1r0f1s0f0y0g0z0g100g110g1m0g1n0g1o0g1p0g1q0g1r0g1s0g0y0h0z0h100h120h1l0h1n0h1o0h1p0h1q0h1r0h1s0h1t0h0y0i0z0i130i1l0i1o0i1p0i1q0i1r0i1s0i1t0i1u0i0x0j0y0j130j140j150j1l0j1o0j1p0j1q0j1r0j1s0j1t0j1u0j0x0k140k150k160k170k1l0k1o0k1p0k1q0k1r0k1s0k1t0k1u0k1v0k0w0l0x0l140l150l160l170l1o0l1p0l1q0l1r0l1s0l1t0l1u0l1v0l1w0l0w0m140m150m1p0m1q0m1r0m1s0m1t0m1u0m1v0m1w0m1x0m0v0n0w0n150n1p0n1q0n1r0n1s0n1t0n1u0n1v0n1w0n1x0n0v0o0w0o170o1p0o1q0o1r0o1s0o1t0o1u0o1v0o1w0o1x0o1y0o0r0p0v0p0w0p160p170p1p0p1q0p1r0p1s0p1t0p1u0p1v0p1w0p1x0p1y0p0r0q0v0q0w0q150q160q170q1j0q1q0q1r0q1s0q1t0q1u0q1v0q1w0q1x0q1y0q0q0r0v0r120r130r140r150r160r1j0r1q0r1r0r1s0r1t0r1w0r1x0r0q0s0u0s0v0s110s120s130s1q0s1r0s1s0s1t0s0u0t0v0t100t110t120t130t1o0t1q0t1r0t1s0t1t0t0u0u100u110u120u130u1o0u1q0u1r0u1s0u1t0u1u0u0u0v100v110v120v130v1o0v1r0v1s0v1t0v100w110w120w'],
  ['h02', '#7bf5e6', '0x0b0y0b0w0c0x0c0y0c0w0d0x0d0y0d0w0e0x0e0y0e0v0f0w0f0x0f0y0f0v0g0w0g0x0g1l0g0v0h0w0h0x0h1m0h0u0i0v0i0w0i0x0i1m0i1n0i0u0j0v0j0w0j1m0j1n0j0u0k0v0k0w0k1m0k1n0k0t0l0u0l0v0l1n0l0t0m0u0m0v0m1n0m1o0m0t0n0u0n1n0n1o0n0s0o0t0o0u0o1n0o1o0o0s0p0t0p0u0p1o0p0s0q0t0q0u0q1o0q1p0q0r0r0s0r0t0r0u0r1o0r1p0r0r0s0s0s0t0s1o0s1p0s0r0t0s0t0t0t1p0t0s0u0t0u1p0u1p0v1q0v'],
  ['h03', '#0f6d66', '1w0l1x0m1x0n1y0o0r0p1y0p0r0q1z0q0q0r1z0r0q0s200s0q0t1o0t200t0p0u1o0u210u0p0v1o0v0p0w1o0w0o0x1p0x1p0y1p0z1p101q11'],
  ['h03', '#20bcae', '0x0o0x0p0y0p0z0p0x0q0y0q0z0q0w0r0x0r0y0r0z0r1u0r1v0r0w0s0x0s0y0s0z0s1u0s1v0s1w0s0w0t0x0t0y0t0z0t1u0t1v0t1w0t0v0u0w0u0x0u0y0u0z0u1v0u1w0u1x0u0v0v0w0v0x0v0y0v0z0v1v0v1w0v1x0v0v0w0w0w0x0w0y0w0z0w1v0w1w0w1x0w1y0w0u0x0v0x0w0x0x0x0y0x0z0x1v0x1w0x1x0x1y0x0u0y0v0y0w0y0x0y0y0y1v0y1w0y1x0y1y0y1z0y0t0z0u0z0v0z0w0z0x0z0y0z1w0z1x0z1y0z1z0z200z0t100u100v100w100x101w101x101y101z1020100s110t110u110v110w111w111x111y111z110s120t120u120v120w121x120s130t130u130v130s140t140u140v14'],
  ['h03', '#3fe0d0', '1t0i1u0i1v0i1t0j1u0j1v0j1t0k1u0k1v0k1w0k1s0l1t0l1u0l1v0l0s0m1r0m1s0m1t0m1u0m1v0m1w0m0s0n0v0n0w0n1q0n1r0n1s0n1t0n1u0n1v0n1w0n0r0o0v0o0w0o1p0o1q0o1r0o1s0o1t0o1u0o1v0o1w0o1x0o0v0p0w0p1p0p1q0p1r0p1s0p1t0p1u0p1v0p1w0p1x0p0v0q0w0q100q1n0q1q0q1r0q1s0q1t0q1u0q1v0q1w0q1x0q1y0q0v0r100r120r1n0r1q0r1r0r1s0r1t0r1w0r1x0r1y0r0u0s0v0s100s110s120s1n0s1q0s1r0s1s0s1t0s1x0s1y0s1z0s0u0t0v0t100t110t120t1q0t1r0t1s0t1t0t1x0t1y0t1z0t0u0u100u110u120u1q0u1r0u1s0u1t0u1u0u1y0u1z0u200u0t0v0u0v100v110v120v1r0v1s0v1t0v1u0v1y0v1z0v200v210v0t0w0u0w100w110w120w1r0w1s0w1t0w1u0w1z0w200w210w220w0t0x100x110x120x1r0x1s0x1t0x1u0x1z0x200x210x220x0o0y0s0y0t0y0z0y100y110y120y1r0y1s0y1t0y1u0y200y210y220y0o0z0s0z0z0z100z110z1s0z1t0z1u0z1v0z210z0n100r100s100y100z10101012101r101s101t101u101v100r110x110y110z1110111r111s111t111u111v110r120x120y120z1211121q121t121u121v121w120q130r130w130x130y130z1310131q131t131u131v131w130w140x140y141q141t141u14'],
  ['h03', '#7bf5e6', '0t0m0u0m0v0m0t0n0u0n0s0o0t0o0u0o0s0p0t0p0u0p1o0p0s0q0t0q0u0q1o0q1p0q0r0r0s0r0t0r0u0r1o0r1p0r0r0s0s0s0t0s1o0s1p0s0r0t0s0t0t0t1p0t0q0u0r0u0s0u0t0u1p0u0q0v0r0v0s0v1p0v1q0v0q0w0r0w0s0w1p0w1q0w0p0x0q0x0r0x0s0x1q0x0p0y0q0y0r0y1q0y0p0z0q0z0r0z120z1q0z1r0z0o100p100q1011101q100o110p110q1111110p120q1210121r121s121r131s130z141r141s14'],
  ['h04', '#0f6d66', '210v220w220x0o0y230y0o0z230z0n1024100n1124110m121q1225120m131q130m141q140l151q151r161r171r181r19'],
  ['h04', '#20bcae', '200s1w0t200t1v0u1w0u1x0u210u0p0v1v0v1w0v1x0v0p0w1v0w1w0w1x0w1y0w0o0x0u0x0v0x1v0x1w0x1x0x1y0x0u0y0v0y0w0y0x0y1p0y1v0y1w0y1x0y1y0y1z0y0t0z0u0z0v0z0w0z0x0z0y0z0z0z1p0z1w0z1x0z1y0z1z0z200z0t100u100v100w100x100y100z101p101w101x101y101z1020100s110t110u110v110w110x110y110z111q111w111x111y111z11201121110s120t120u120v120w120x120y120z121x121y121z12201221120s130t130u130v130w130x130y130z131x131y131z1320132113221325130r140s140t140u140v140w140x140y141x141y141z1420142114221426140r150s150t150u150v150w150x151x151y151z15201521152215231526150l160q160r160s160t160u160v160w160x161x161y161z16201621162216231624160l170q170r170s170t170u170v170w171x171y171z172017211722172317241725170k180q180r180s180t180u180v180w181x181y181z1820182118221823180k190p190q190r190s190t190u190v191x191y191z192019211922190p1a0q1a0r1a0s1a0t1a0u1a0v1a1s1a1y1a1z1a201a0o1b0p1b0q1b0r1b0s1b0t1b0u1b0v1b1s1b1y1b1z1b0p1c0q1c0r1c0s1c0t1c0u1c0v1c0w1c1s1c'],
  ['h04', '#3fe0d0', '1x0s1y0s1z0s1x0t1y0t1z0t1y0u1z0u200u0t0v1u0v1y0v1z0v200v0t0w0u0w1s0w1t0w1u0w1z0w200w210w0t0x1r0x1s0x1t0x1u0x1z0x200x210x0s0y0t0y1r0y1s0y1t0y1u0y200y210y220y0s0z1s0z1t0z1u0z1v0z210z220z0r100s101r101s101t101u101v102110221023100r111r111s111t111u111v11221123110r121t121u121v121w122212231224120q130r131t131u131v131w13231324130q141t141u141v141w142314241425140p150q151s151t151u151v151w15241525150p161s161t161u161v161w16251626160p171t171u171v171w170o180p180y181t181u181v181w180o190x191s191t191u191v191w190n1a0o1a0w1a0x1a1t1a1u1a1v1a1w1a1x1a0n1b0w1b1u1b1v1b1w1b1x1b1v1c1w1c1x1c'],
  ['h04', '#7bf5e6', '0q0v0r0v0s0v0q0w0r0w0s0w0p0x0q0x0r0x0s0x0p0y0q0y0r0y1q0y0p0z0q0z0r0z1q0z1r0z0o100p100q101q100o110p110q110n120o120p120q121r121s120n130o130p131r131s130n140o140p140z141r141s140m150n150o150y150z151r150m160n160o160y160m170n170o170x170y171s170l180m180n180x181s180l190m190n190w190m1a1t1b1t1c1u1c'],
  ['h05', '#0f6d66', '2513261426150l1627160l1727170k1827180k1928190j1a1s1a0j1b1s1b0j1c1s1c0i1d1s1d1s1e1t1f1t1g1t1h1t1i'],
  ['h05', '#20bcae', '24102011211124111y121z122012211225120m131x131y131z132013211322130m140r141x141y141z142014211422140l150r150s151x151y151z1520152115221523150q160r160s160t160u161x161y161z16201621162216231624160q170r170s170t170u170v171r171x171y171z172017211722172317241725170q180r180s180t180u180v181r181x181y181z182018211822182318241825180p190q190r190s190t190u190v191r191x191y191z192019211922192319241925190p1a0q1a0r1a0s1a0t1a0u1a0v1a1y1a1z1a201a211a221a231a241a251a281a0o1b0p1b0q1b0r1b0s1b0t1b0u1b0v1b1y1b1z1b201b211b221b231b241b251b261b291b0n1c0o1c0p1c0q1c0r1c0s1c0t1c0u1c0v1c1z1c201c211c221c231c241c251c261c291c0n1d0o1d0p1d0q1d0r1d0s1d0t1d0u1d0v1d1z1d201d211d221d231d241d251d261d271d281d2a1d0i1e0m1e0n1e0o1e0p1e0q1e0r1e0s1e1z1e201e211e221e231e241e251e261e271e281e0i1f0m1f0n1f0o1f0p1f0q1f0r1f0s1f1z1f201f211f221f231f241f251f261f271f281f0h1g0l1g0m1g0n1g0o1g0p1g0q1g0r1g1z1g201g211g221g231g241g251g261g271g0h1h0l1h0m1h0n1h0o1h0p1h0q1h0r1h201h211h221h231h241h251h0l1i0m1i0n1i0o1i0p1i0q1i201i211i221i231i241i1t1j1z1j201j211j221j1u1k201k1u1l'],
  ['h05', '#3fe0d0', '21102210231022112311221223122412231324130q141v141w142314241425140p150q151u151v151w15241525150p161s161t161u161v161w16251626160p171t171u171v171w1726170o180p181t181u181v181w1826180o191s191t191u191v191w19261927190n1a0o1a1t1a1u1a1v1a1w1a1x1a261a271a0m1b0n1b1u1b1v1b1w1b1x1b271b281b0m1c1v1c1w1c1x1c1y1c271c281c0l1d0m1d1u1d1v1d1w1d1x1d1y1d291d0l1e1t1e1u1e1v1e1w1e1x1e1y1e291e0k1f0l1f1u1f1v1f1w1f1x1f1y1f0k1g1v1g1w1g1x1g1y1g0j1h0k1h1v1h1w1h1x1h1y1h1z1h0j1i0k1i1v1i1w1i1x1i1y1i1z1i1u1j1v1j1w1j1x1j1y1j1v1k1w1k1x1k1y1k1z1k1v1l1w1l1x1l1y1l'],
  ['h05', '#7bf5e6', '0n130o130p130n140o140p140m150n150o150m160n160o160m170n170o171s170l180m180n181s180l190m190n190k1a0l1a0m1a0k1b0l1b1t1b0k1c0l1c1t1c1u1c0j1d0k1d1t1d0j1e0k1e0t1e0u1e0v1e0j1f0t1f0u1f0i1g0j1g0s1g0t1g1u1g0i1h0s1h1u1h0r1i1u1i'],
  ['h06', '#0f6d66', '281a291b291c2a1d0i1e2a1e0i1f2a1f0h1g2b1g0h1h2b1h0g1i2c1i0g1j1t1j0g1k1u1k0f1l1u1l1u1m1u1n1u1o1u1p1v1q'],
  ['h06', '#10897f', '251n261n251o261o251p261p271p251q261q'],
  ['h06', '#20bcae', '251727172418251827182319241925192819221a231a241a251a0j1b201b211b221b231b241b251b261b0j1c0n1c0o1c1z1c201c211c221c231c241c251c261c0i1d0n1d0o1d0p1d1z1d201d211d221d231d241d251d261d271d281d0m1e0n1e0o1e0p1e1z1e201e211e221e231e241e251e261e271e281e0m1f0n1f0o1f0p1f1t1f1z1f201f211f221f231f241f251f261f271f281f0l1g0m1g0n1g0o1g0p1g1t1g1z1g201g211g221g231g241g251g261g271g281g0l1h0m1h0n1h0o1h0p1h1t1h201h211h221h231h241h251h261h271h281h291h0l1i0m1i0n1i0o1i0p1i1t1i201i211i221i231i241i251i261i271i281i291i2a1i0k1j0l1j0m1j0n1j0o1j0p1j1z1j201j211j221j231j241j251j261j271j281j291j2a1j2b1j2c1j0k1k0l1k0m1k0n1k0o1k201k211k221k231k241k251k261k271k281k291k2a1k2b1k2c1k0j1l0k1l0l1l0m1l0n1l0o1l201l211l221l231l241l251l261l271l281l291l2a1l2b1l2c1l2d1l0f1m0j1m0k1m0l1m0n1m0o1m211m221m231m241m251m261m271m281m291m2a1m2b1m2c1m2d1m0e1n0i1n0j1n0k1n0l1n0m1n0n1n0o1n211n221n231n241n271n281n291n2a1n2b1n0e1o0i1o0j1o0k1o0l1o0n1o211o221o231o241o271o281o291o2a1o0h1p0i1p0j1p0k1p201p211p221p231p241p281p0h1q0i1q0j1q0k1q201q211q221q231q241q1v1r211r221r231r241r251r1v1s221s231s1v1t'],
  ['h06', '#3fe0d0', '2617261826192719261a271a0m1b271b281b0m1c271c281c0l1d0m1d1x1d1y1d291d0l1e1v1e1w1e1x1e1y1e291e0k1f0l1f1u1f1v1f1w1f1x1f1y1f291f0k1g1v1g1w1g1x1g1y1g291g2a1g0j1h0k1h1v1h1w1h1x1h1y1h1z1h2a1h0j1i0k1i1v1i1w1i1x1i1y1i1z1i2b1i0i1j0j1j1u1j1v1j1w1j1x1j1y1j0i1k0j1k1v1k1w1k1x1k1y1k1z1k0h1l0i1l1v1l1w1l1x1l1y1l1z1l0h1m0i1m1x1m1y1m1z1m201m0g1n0h1n1x1n1y1n1z1n201n0g1o0h1o1w1o1x1o1y1o1z1o201o0f1p0g1p0m1p1v1p1w1p1x1p1y1p1z1p0g1q0l1q0m1q1w1q1x1q1y1q1z1q1w1r1x1r1y1r1z1r201r1y1s1z1s201s211s1y1t1z1t201t'],
  ['h06', '#7bf5e6', '0k1b0l1b0k1c0l1c0j1d0k1d0j1e0k1e0j1f0i1g0j1g1u1g0i1h1u1h0h1i0i1i1u1i0h1j0h1k0g1l0g1m1v1m1w1m0f1n1v1n1w1n0f1o0m1o1v1o0e1p0l1p1w1s1x1s1w1t1x1t'],
  ['h07', '#0f6d66', '2c1j2c1k2d1l0f1m2d1m0e1n2d1n0e1o2e1o0d1p2e1p0d1q0c1r1v1r0c1s1v1s1v1t1v1u1v1v1v1w1w1x1w1y1w1z'],
  ['h07', '#10897f', '251n261n251o261o251p261p271p251q261q271q261r271r281r261s271s281s261t271t281t291t261u271u281u291u261v271v281v291v261w271w281w291w261x271x281x291x271y281y291y271z'],
  ['h07', '#20bcae', '281g2b1g261h271h281h291h2b1h251i261i271i281i291i2a1i2c1i0g1j231j241j251j261j271j281j291j2a1j2b1j0g1k0k1k0l1k211k221k231k241k251k261k271k281k291k2a1k2b1k0f1l0j1l0k1l0l1l201l211l221l231l241l251l261l271l281l291l2a1l2b1l2c1l0j1m0k1m0l1m211m221m231m241m251m261m271m281m291m2a1m2b1m2c1m0i1n0j1n0k1n0l1n211n221n231n241n271n281n291n2a1n2b1n2c1n0i1o0j1o0k1o0l1o1u1o211o221o231o241o271o281o291o2a1o2b1o2c1o2d1o0h1p0i1p0j1p0k1p1u1p201p211p221p231p241p281p291p2a1p2b1p2c1p2d1p0h1q0i1q0j1q0k1q1v1q201q211q221q231q241q281q291q2a1q2b1q2c1q2d1q2e1q0g1r0h1r0i1r0j1r0k1r0l1r211r221r231r241r251r291r2a1r2b1r2c1r2d1r2e1r2f1r0g1s0h1s0i1s0j1s0k1s221s231s241s251s291s2a1s2b1s2c1s2d1s2e1s2f1s0c1t0g1t0h1t0i1t0j1t0k1t221t231t241t251t2a1t2b1t2c1t2d1t2e1t2f1t0b1u0g1u0h1u0i1u0j1u221u231u241u251u2a1u2b1u2c1u2d1u2e1u2f1u0b1v0g1v0h1v0i1v0j1v211v221v231v241v251v2a1v2b1v2c1v2d1v2e1v0a1w0h1w0i1w0j1w211w221w231w241w251w2a1w2b1w2c1w2d1w0h1x0i1x211x221x231x241x251x2a1x2b1x221y231y241y251y261y231z241z251z261z1w202320242025201w2123211w22'],
  ['h07', '#3fe0d0', '291g2a1g2a1h2b1i0i1j0j1j0i1k0j1k0h1l0i1l0h1m0i1m1y1m1z1m201m0g1n0h1n1x1n1y1n1z1n201n0g1o0h1o1w1o1x1o1y1o1z1o201o0f1p0g1p1v1p1w1p1x1p1y1p1z1p0f1q0g1q0l1q1w1q1x1q1y1q1z1q0e1r0f1r1w1r1x1r1y1r1z1r201r0e1s0f1s1y1s1z1s201s211s0e1t0f1t1y1t1z1t201t211t0e1u0f1u1y1u1z1u201u211u0e1v0f1v1w1v1x1v1y1v1z1v201v0e1w0f1w0g1w1w1w1x1w1y1w1z1w201w0e1x0f1x0g1x1x1x1y1x1z1x201x1x1y1y1y1z1y201y211y1y1z1z1z201z211z221z1z202020212022201z212021212122211z222022'],
  ['h07', '#7bf5e6', '0h1j0h1k0g1l0g1m0f1n1v1n1w1n0f1o1v1o0e1p0l1p0e1q0d1r0d1s1w1s1x1s0d1t1w1t1x1t0c1u0d1u1w1u1x1u0c1v0d1v0b1w0c1w0d1w0b1x0c1x0d1x1x1z1x201y201x211y211x221y22'],
  ['h08', '#0f6d66', '2e1q2f1r2f1s0c1t2f1t0b1u2f1u0b1v2g1v0a1w2g1w0a1x2g1x091y2h1y091z2h1z08201w201w211w221w231w241w251w261v271v28'],
  ['h08', '#10897f', '261r271r281r261s271s281s261t271t281t291t261u271u281u291u261v271v281v291v261w271w281w291w261x271x281x291x271y281y291y2a1y271z281z291z2a1z2b1z2720282029202a202b202721282129212a212b212722282229222a222b22282329232a232b232724282429242a242b242c242725282529252a252b252c252d250f260g260h262726282629262a262b262c260f270g270h272727282729272a270e280f280g280h28272828280g290h29'],
  ['h08', '#20bcae', '2b1n2c1n2d1n2b1o2c1o2d1o2e1o291p2a1p2b1p2c1p2d1p2e1p0d1q281q291q2a1q2b1q2c1q2d1q0c1r0g1r291r2a1r2b1r2c1r2d1r2e1r0c1s0g1s0h1s0i1s241s251s291s2a1s2b1s2c1s2d1s2e1s0g1t0h1t0i1t0j1t221t231t241t251t2a1t2b1t2c1t2d1t2e1t0g1u0h1u0i1u0j1u0k1u0l1u221u231u241u251u2a1u2b1u2c1u2d1u2e1u0g1v0h1v0i1v0j1v0k1v0l1v211v221v231v241v251v2a1v2b1v2c1v2d1v2e1v2f1v0h1w0i1w0j1w0k1w0l1w0m1w0n1w0o1w1v1w211w221w231w241w251w2a1w2b1w2c1w2d1w2e1w2f1w0h1x0i1x0j1x0k1x0l1x0m1x0n1x0o1x1w1x211x221x231x241x251x2a1x2b1x2c1x2d1x2e1x2f1x0f1y0g1y0h1y0i1y0k1y0l1y0m1y0n1y0o1y1w1y221y231y241y251y261y2b1y2c1y2d1y2e1y2f1y2g1y0f1z0g1z0h1z0i1z0j1z0k1z0m1z0n1z0o1z1w1z231z241z251z261z2c1z2d1z2e1z2f1z2g1z0f200g200i200j200k200m200n200o2023202420252026202c202d202e202f202g202h2008210m210n210o2123212421252126212c212d212e212f212g212h2107220m2223222422252226222c222d222e222f222g222h2207230f230g230h230k230l230m230n230o23232324232523262327232c232d232e232f232g232h232i2306240e240f240g240h240i240j240k240l240m240n240o2423242424252426242d242e242f242g240d250e250f250g250h250i250j250k250l250m250n250o2523252425252526252e250d260e260i260j260k260l260m260n260o262426252626260c270d270e270i270j270k270l270m270n270o2723272427252726270i280j280k280l280m280n280o2823282428252826280i290j290k290l290m290n290o291v29222923292429252926291v2a222a232a1v2b'],
  ['h08', '#3fe0d0', '0f1q0e1r0f1r0e1s0f1s0e1t0f1t0e1u0f1u201u211u0e1v0f1v1y1v1z1v201v0e1w0f1w0g1w1w1w1x1w1y1w1z1w201w0e1x0f1x0g1x1x1x1y1x1z1x201x0d1y0e1y1x1y1y1y1z1y201y211y0d1z0e1z1y1z1z1z201z211z221z0d200e200h200l201z202020212022200c210d210e210f210g210h210i210j210k210l211z212021212122210c220d220e220f220g220h220i220j220k220l221z222022212222220c230d230e230i230j231z232023212322230b240c240d241z242024212422240a250b250c251z252025212522250a260b260c261z2620262126222623261z272027212722271y281z282028212822281y291z29202921291y2a1z2a202a212a1y2b1z2b202b'],
  ['h08', '#7bf5e6', '0e1q0d1r0d1s0d1t0c1u0d1u0c1v0d1v0b1w0c1w0d1w0b1x0c1x0d1x0a1y0b1y0c1y0a1z0b1z0c1z0l1z1x1z09200a200b200c201x201y2009210a210b211x211y21082209220a220b221x221y22082309230a230b231x231y230724082409240a241x241y24082509251x251y251x261y261w271x271y271w281x281w291x291w2a1x2a1w2b1x2b'],
  ['h09', '#0f6d66', '2h2008212h2107222h2207232i2306242i2406252i2505262i2605272i272i281v291v2a1v2b1v2c1v2d1u2e1u2f1u2g'],
  ['h09', '#10897f', '291z2a1z2b1z2720282029202a202b202721282129212a212b212722282229222a222b22282329232a232b232724282429242a242b242c242725282529252a252b252c252d250f260g260h262726282629262a262b262c262d260f270g270h272727282729272a272b272c272d270e280f280g280h282728282829282a282b282c282d280e290f290g290h292729282929292a292b292c292d290e2a0f2a0g2a0h2a262a272a282a292a2a2a2b2a2c2a2d2a0d2b0e2b0f2b0g2b0h2b272b282b292b2a2b2b2b2c2b2d2b0d2c0e2c0f2c0g2c0h2c272c282c292c2a2c2b2c2c2c2d2c0d2d0e2d0f2d0g2d0h2d272d282d292d2a2d2b2d2c2d2d2d0d2e0e2e0f2e0g2e0h2e272e282e292e2a2e2b2e2c2e2d2e0c2f0d2f0e2f0f2f0g2f0h2f262f272f282f292f2a2f2b2f2c2f2d2f0c2g0d2g0e2g0f2g0g2g0h2g262g272g282g292g2a2g2b2g0e2h0f2h0g2h0h2h262h272h282h0h2i262i'],
  ['h09', '#20bcae', '2d1x2e1x2f1x2g1x091y2b1y2c1y2d1y2e1y2f1y2g1y2h1y091z2c1z2d1z2e1z2f1z2g1z2h1z08200f202c202d202e202f202g20252126212c212d212e212f212g2123222422252226222c222d222e222f222g220f230g230h230k230l23232324232523262327232c232d232e232f232g232h230e240f240g240h240i240j240k240l240m240n240o2423242424252426242d242e242f242g242h240d250e250f250g250h250i250j250k250l250m250n250o251w2523252425252526252e252f252g252h250d260e260i260j260k260l260m260n260o261w262426252626262e262f262g262h260c270d270e270i270j270k270l270m270n270o271v2723272427252726272e272f272g272h2705280c280d280i280j280k280l280m280n280o281v2823282428252826282e282f282g282h2804290c290d290i290j290k290l290m290n290o29222923292429252926292e292f292g292h292i29042a0c2a0d2a0i2a0j2a0k2a0l2a0m2a0n2a0o2a222a232a242a252a2e2a2f2a2g2a2h2a2i2a032b0b2b0c2b0i2b0j2b0k2b0l2b0m2b0n2b0o2b222b232b242b252b262b2e2b2f2b2g2b2h2b2i2b032c0b2c0c2c0i2c0j2c0k2c0l2c0m2c0n2c0o2c222c232c242c252c262c2e2c2f2c2g2c2h2c2i2c0a2d0b2d0c2d0i2d0j2d0k2d0l2d0m2d0n2d0o2d222d232d242d252d262d2e2d2f2d2g2d2h2d0a2e0b2e0c2e0i2e0j2e0k2e0l2e0m2e0n2e0o2e222e232e242e252e262e2e2e2f2e0a2f0b2f0i2f0j2f0k2f0l2f0m2f0n2f0o2f222f232f242f252f0b2g0i2g0j2g0k2g0l2g0m2g0n2g0o2g212g222g232g242g252g0i2h0j2h0k2h0l2h0m2h0n2h0o2h1u2h212h222h232h242h252h0i2i0j2i0k2i0l2i0m2i0n2i0o2i1t2i212i222i232i242i252i1t2j212j222j232j1t2k'],
  ['h09', '#3fe0d0', '0d1z0d200e200c210d210e210f210g210h210c220d220e220f220g220h220i220j220c230d230e230i230j23212322230b240c240d241z242024212422240a250b250c251z252025212522250a260b260c261z26202621262226232609270a270b271z2720272127222709280a280b281y281z2820282128222809290a290b291y291z2920292129082a092a0a2a0b2a1y2a1z2a202a212a082b092b0a2b1y2b1z2b202b212b072c082c092c0a2c1y2c1z2c202c212c072d082d092d1y2d1z2d202d212d072e082e092e1y2e1z2e202e212e092f1x2f1y2f1z2f202f212f1x2g1y2g1z2g202g1x2h1y2h1z2h202h1x2i1y2i1z2i202i1w2j1x2j1y2j1z2j202j1w2k1x2k1y2k1z2k'],
  ['h09', '#7bf5e6', '0a1y0b1y0a1z0b1z0c1z09200a200b200c2009210a210b21082209220a220b22082309230a230b230724082409240a241y240725082509251x251y2506260726082609261x261y260627072708271w271x271y270628072808281w281x2805290629072908291w291x29052a062a072a1w2a1x2a042b052b062b072b1w2b1x2b042c052c062c1w2c1x2c052d062d1w2d1x2d1v2e1w2e1x2e1v2f1w2f1v2g1w2g1v2h1w2h1u2i1v2i1w2i1u2j1v2j1u2k1v2k'],
  ['h10', '#0f6d66', '052804292i29042a2i2a032b2i2b032c2i2c032d2i2d022e2i2e022f2i2f022g2i2g1u2h2i2h1t2i2i2i1t2j1t2k1t2l1s2m1s2n1s2o1r2p1r2q'],
  ['h10', '#10897f', '2c272d272a282b282c282d280e29282929292a292b292c292d290e2a0f2a0g2a262a272a282a292a2a2a2b2a2c2a2d2a0d2b0e2b0f2b0g2b0h2b272b282b292b2a2b2b2b2c2b2d2b0d2c0e2c0f2c0g2c0h2c272c282c292c2a2c2b2c2c2c2d2c0d2d0e2d0f2d0g2d0h2d272d282d292d2a2d2b2d2c2d2d2d0d2e0e2e0f2e0g2e0h2e272e282e292e2a2e2b2e2c2e2d2e0c2f0d2f0e2f0f2f0g2f0h2f262f272f282f292f2a2f2b2f2c2f2d2f0c2g0d2g0e2g0f2g0g2g0h2g262g272g282g292g2a2g2b2g2c2g2d2g0c2h0d2h0e2h0f2h0g2h0h2h262h272h282h292h2a2h2b2h2c2h2d2h0c2i0d2i0e2i0f2i0g2i0h2i262i272i282i292i2a2i2b2i2c2i2d2i2e2i0c2j0d2j0e2j0f2j0g2j0h2j262j272j282j292j2a2j2b2j2c2j2d2j2e2j0b2k0c2k0d2k0e2k0f2k0g2k0h2k0i2k252k262k272k282k292k2a2k2b2k2c2k2d2k2e2k0b2l0c2l0d2l0e2l0f2l0g2l0h2l0i2l252l262l272l282l292l2a2l2b2l2c2l2d2l2e2l0b2m0c2m0d2m0e2m0f2m0g2m0h2m0i2m252m262m272m282m292m2a2m2b2m2c2m2d2m2e2m0b2n0c2n0d2n0e2n0f2n0g2n0h2n0i2n242n252n262n272n282n292n2a2n2b2n2c2n2d2n2e2n0b2o0c2o0d2o0e2o0f2o0g2o0h2o0i2o242o252o262o272o282o292o2a2o2b2o2c2o2d2o0b2p0c2p0d2p0e2p0f2p0g2p0h2p0i2p242p252p262p272p282p292p2a2p2b2p0e2q0f2q0g2q0h2q0i2q232q242q252q262q272q282q0h2r0i2r232r242r252r'],
  ['h10', '#20bcae', '062505262e262f262g262h262i2605272e272f272g272h272i270c282e282f282g282h282i280c290d292e292f292g292h290c2a0d2a2e2a2f2a2g2a2h2a0b2b0c2b0i2b0j2b232b242b252b262b2e2b2f2b2g2b2h2b0b2c0c2c0i2c0j2c0k2c0l2c0m2c222c232c242c252c262c2e2c2f2c2g2c2h2c0a2d0b2d0c2d0i2d0j2d0k2d0l2d0m2d0n2d0o2d222d232d242d252d262d2e2d2f2d2g2d2h2d0a2e0b2e0c2e0i2e0j2e0k2e0l2e0m2e0n2e0o2e1u2e222e232e242e252e262e2e2e2f2e2g2e2h2e0a2f0b2f0i2f0j2f0k2f0l2f0m2f0n2f0o2f1u2f222f232f242f252f2e2f2f2f2g2f2h2f092g0a2g0b2g0i2g0j2g0k2g0l2g0m2g0n2g0o2g1u2g212g222g232g242g252g2e2g2f2g2g2g2h2g022h092h0a2h0b2h0i2h0j2h0k2h0l2h0m2h0n2h0o2h212h222h232h242h252h2e2h2f2h2g2h2h2h012i092i0a2i0b2i0i2i0j2i0k2i0l2i0m2i0n2i0o2i212i222i232i242i252i2f2i2g2i2h2i012j082j092j0a2j0b2j0i2j0j2j0k2j0l2j0m2j0n2j0o2j212j222j232j242j252j2f2j2g2j2h2j2i2j012k082k092k0a2k0j2k0k2k0l2k0m2k0n2k0o2k202k212k222k232k242k2f2k2g2k2h2k2i2k072l082l092l0a2l0j2l0k2l0l2l0m2l0n2l0o2l202l212l222l232l242l2f2l2g2l2h2l2i2l082m092m0a2m0j2m0k2m0l2m0m2m0n2m0o2m202m212m222m232m242m2f2m2g2m2h2m082n092n0a2n0j2n0k2n0l2n0m2n0n2n0o2n202n212n222n232n2f2n2g2n092o0a2o0j2o0k2o0l2o0m2o0n2o0o2o1z2o202o212o222o232o0j2p0k2p0l2p0m2p0n2p0o2p1z2p202p212p222p232p0j2q0k2q0l2q0m2q0n2q0o2q1y2q1z2q202q212q222q0j2r0k2r0l2r0m2r0n2r0o2r1r2r1y2r1z2r202r212r222r1r2s1y2s1z2s202s212s222s1q2t1y2t'],
  ['h10', '#3fe0d0', '09270a2709280a280b2809290a290b29082a092a0a2a0b2a082b092b0a2b072c082c092c0a2c212c072d082d092d1y2d1z2d202d212d062e072e082e092e1y2e1z2e202e212e052f062f072f082f092f1x2f1y2f1z2f202f212f052g062g072g082g1x2g1y2g1z2g202g052h062h072h082h1x2h1y2h1z2h202h052i062i072i082i1x2i1y2i1z2i202i042j052j062j072j1w2j1x2j1y2j1z2j202j032k042k052k062k072k1w2k1x2k1y2k1z2k032l042l052l062l1w2l1x2l1y2l1z2l042m052m062m072m1w2m1x2m1y2m1z2m062n072n1w2n1x2n1y2n1z2n1v2o1w2o1x2o1y2o1v2p1w2p1x2p1y2p1u2q1v2q1w2q1x2q1u2r1v2r1w2r1x2r1u2s1v2s1w2s1x2s1t2t1u2t1v2t1w2t1x2t'],
  ['h10', '#7bf5e6', '072508250626072608260627072708270628072808280529062907290829052a062a072a042b052b062b072b042c052c062c042d052d062d032e042e052e1v2e1w2e1x2e032f042f1v2f1w2f032g042g1v2g1w2g032h042h1v2h1w2h022i032i042i1u2i1v2i1w2i022j032j1u2j1v2j022k1u2k1v2k022l1u2l1v2l1t2m1u2m1v2m1t2n1u2n1v2n1t2o1u2o1s2p1t2p1u2p1s2q1t2q1s2r1t2r1s2s1t2s1r2t1s2t'],
  ['h11', '#0f6d66', '022h012i012j2i2j012k2i2k012l2i2l012m2h2m012n2h2n012o2h2o002p2g2p2g2q1r2r2g2r1r2s2f2s1q2t1q2u1q2v1q2w1q2x1q2y1q2z'],
  ['h11', '#10897f', '022e022f022g2d2g2i2g2b2h2c2h2d2h2i2h0c2i0d2i0e2i282i292i2a2i2b2i2c2i2d2i2e2i2i2i0c2j0d2j0e2j0f2j0g2j262j272j282j292j2a2j2b2j2c2j2d2j2e2j0b2k0c2k0d2k0e2k0f2k0g2k0h2k0i2k252k262k272k282k292k2a2k2b2k2c2k2d2k2e2k0b2l0c2l0d2l0e2l0f2l0g2l0h2l0i2l0m2l252l262l272l282l292l2a2l2b2l2c2l2d2l2e2l0b2m0c2m0d2m0e2m0f2m0g2m0h2m0i2m0m2m0n2m0o2m252m262m272m282m292m2a2m2b2m2c2m2d2m2e2m0b2n0c2n0d2n0e2n0f2n0g2n0h2n0i2n0m2n0n2n0o2n242n252n262n272n282n292n2a2n2b2n2c2n2d2n2e2n0b2o0c2o0d2o0e2o0f2o0g2o0h2o0i2o0m2o0n2o0o2o1s2o242o252o262o272o282o292o2a2o2b2o2c2o2d2o2e2o0b2p0c2p0d2p0e2p0f2p0g2p0h2p0i2p0m2p0n2p0o2p1r2p242p252p262p272p282p292p2a2p2b2p2c2p2d2p2e2p002q0b2q0c2q0d2q0e2q0f2q0g2q0h2q0i2q0l2q0m2q0n2q0o2q1r2q232q242q252q262q272q282q292q2a2q2b2q2c2q2d2q002r0a2r0b2r0c2r0d2r0e2r0f2r0g2r0h2r0i2r0l2r0m2r0n2r0o2r232r242r252r262r272r282r292r2a2r2b2r2c2r2d2r002s0a2s0b2s0c2s0d2s0e2s0f2s0g2s0h2s0i2s0l2s0m2s0n2s0o2s232s242s252s262s272s282s292s2a2s2b2s2c2s2d2s002t0a2t0b2t0c2t0d2t0e2t0f2t0g2t0h2t0i2t0l2t0m2t0n2t222t232t242t252t262t272t282t292t2a2t2b2t2c2t2d2t2e2t2f2t092u0a2u0b2u0c2u0d2u0e2u0f2u0g2u0h2u0k2u0l2u0m2u0n2u222u232u242u252u262u272u282u292u2a2u2b2u2c2u2d2u2e2u092v0a2v0b2v0c2v0d2v0e2v0f2v0g2v0h2v0k2v0l2v0m2v0n2v212v222v232v242v252v262v272v282v292v2a2v2b2v2c2v2d2v2e2v0a2w0b2w0c2w0d2w0e2w0f2w0g2w0k2w0l2w0m2w0n2w212w222w232w242w252w262w272w282w292w2a2w2b2w2c2w2d2w0a2x0b2x0c2x0d2x0e2x0f2x0g2x0k2x0l2x0m2x202x212x222x232x242x252x262x272x282x292x2a2x2b2x2c2x0b2y0c2y0d2y0e2y0f2y0g2y0k2y0l2y0m2y202y212y222y232y242y252y262y272y282y292y2a2y2b2y0e2z0f2z0g2z0k2z0l2z0m2z1z2z202z212z222z232z242z252z262z272z282z1q301y301z30203021302230233024301q311z3120311q32'],
  ['h11', '#20bcae', '092g2e2g2f2g2g2g2h2g092h0a2h0b2h2e2h2f2h2g2h2h2h092i0a2i0b2i2f2i2g2i2h2i082j092j0a2j0b2j2f2j2g2j2h2j082k092k0a2k0j2k232k242k2f2k2g2k2h2k072l082l092l0a2l0j2l0k2l0l2l202l212l222l232l242l2f2l2g2l2h2l082m092m0a2m0j2m0k2m0l2m202m212m222m232m242m2f2m2g2m082n092n0a2n0j2n0k2n0l2n202n212n222n232n2f2n2g2n082o092o0a2o0j2o0k2o0l2o1z2o202o212o222o232o2f2o2g2o082p092p0a2p0j2p0k2p0l2p1z2p202p212p222p232p2f2p072q082q092q0a2q0j2q0k2q1y2q1z2q202q212q222q2e2q2f2q062r072r082r092r0j2r0k2r1y2r1z2r202r212r222r2e2r2f2r062s072s082s092s0j2s0k2s1y2s1z2s202s212s222s2e2s052t062t072t082t092t0j2t0k2t1y2t1z2t202t212t052u062u072u082u0i2u0j2u1x2u1y2u1z2u202u212u052v062v072v082v0i2v0j2v1w2v1x2v1y2v1z2v202v062w072w082w092w0h2w0i2w0j2w1w2w1x2w1y2w1z2w202w092x0h2x0i2x0j2x1w2x1x2x1y2x1z2x0h2y0i2y0j2y1v2y1w2y1x2y1y2y1z2y0h2z0i2z0j2z1u2z1v2z1w2z1x2z1y2z1t301u301v301w301x301t311u311v311w311x311y311s321t321u321v321w32'],
  ['h11', '#3fe0d0', '052f062f072f052g062g072g082g052h062h072h082h052i062i072i082i042j052j062j072j032k042k052k062k072k032l042l052l062l032m042m052m062m072m1x2m1y2m1z2m042n052n062n072n1w2n1x2n1y2n1z2n042o052o062o072o1v2o1w2o1x2o1y2o032p042p052p062p072p1v2p1w2p1x2p1y2p032q042q052q062q1u2q1v2q1w2q1x2q022r032r042r052r1u2r1v2r1w2r1x2r012s022s032s042s052s1u2s1v2s1w2s1x2s012t022t032t042t1t2t1u2t1v2t1w2t1x2t022u032u042u1t2u1u2u1v2u1w2u042v1r2v1s2v1t2v1u2v1v2v1r2w1s2w1t2w1u2w1v2w1r2x1s2x1t2x1u2x1v2x1r2y1s2y1t2y1u2y1r2z1s2z1t2z1r301s301r311s311r32'],
  ['h11', '#7bf5e6', '032e042e052e032f042f032g042g032h042h022i032i042i022j032j022k022l022m022n032n1t2n1u2n1v2n022o032o1t2o1u2o012p022p1s2p1t2p1u2p012q022q1s2q1t2q012r1s2r1t2r1s2s1t2s1r2t1s2t1r2u1s2u'],
  ['h12', '#0f6d66', '002q002r002s002t2f2t002u2e2u012v2e2v012w2d2w012x2c2x012y2c2y012z2b2z1q302a301q3129311q3228321r331u3327331r341u3426341s351u351v3525351t361w36'],
  ['h12', '#10897f', '012n012o002p0b2q2b2q2c2q2d2q2g2q0a2r0b2r0c2r0d2r0e2r292r2a2r2b2r2c2r2d2r2g2r0a2s0b2s0c2s0d2s0e2s0f2s0g2s262s272s282s292s2a2s2b2s2c2s2d2s2f2s0a2t0b2t0c2t0d2t0e2t0f2t0g2t0h2t0i2t232t242t252t262t272t282t292t2a2t2b2t2c2t2d2t2e2t092u0a2u0b2u0c2u0d2u0e2u0f2u0g2u0h2u0k2u0l2u0m2u222u232u242u252u262u272u282u292u2a2u2b2u2c2u2d2u092v0a2v0b2v0c2v0d2v0e2v0f2v0g2v0h2v0k2v0l2v0m2v212v222v232v242v252v262v272v282v292v2a2v2b2v2c2v2d2v0a2w0b2w0c2w0d2w0e2w0f2w0g2w0k2w0l2w0m2w212w222w232w242w252w262w272w282w292w2a2w2b2w2c2w0a2x0b2x0c2x0d2x0e2x0f2x0g2x0k2x0l2x0m2x1q2x202x212x222x232x242x252x262x272x282x292x2a2x2b2x0a2y0b2y0c2y0d2y0e2y0f2y0g2y0k2y0l2y0m2y1q2y202y212y222y232y242y252y262y272y282y292y2a2y2b2y0a2z0b2z0c2z0d2z0e2z0f2z0g2z0k2z0l2z0m2z1q2z1z2z202z212z222z232z242z252z262z272z282z292z2a2z02300a300b300c300d300e300f300g300k300l300m301y301z30203021302230233024302530263027302830293002310a310b310c310d310e310f310g310k310l310m311z3120312131223123312431253126312731283103320a320b320c320d320e320f320g320h320k320l320m321z322032213222322332243225322632273203330a330b330c330d330e330f330g330h330k330l330m33203321332233233324332533263304340a340b340c340d340e340f340g340h340i340j340k340l340m341n342034213422342334243425340b350c350d350e350f350g350h350i350j350k350l350m351n35203521352235233524350b360c360d360e360f360g360h360i360j360k360l360m36203621362236233624360c370d370e370f370g370h370i370j370k370l371w372137223723370f380g380h380j380k380l381x38213822381x392139'],
  ['h12', '#20bcae', '082p092p072q082q092q0a2q2e2q2f2q062r072r082r092r2e2r2f2r062s072s082s092s2e2s052t062t072t082t092t0j2t052u062u072u082u0i2u0j2u1z2u202u212u052v062v072v082v0i2v0j2v1w2v1x2v1y2v1z2v202v062w072w082w092w0h2w0i2w0j2w1w2w1x2w1y2w1z2w202w062x072x082x092x0h2x0i2x0j2x1w2x1x2x1y2x1z2x062y072y082y092y0h2y0i2y0j2y1v2y1w2y1x2y1y2y1z2y062z072z082z092z0h2z0i2z0j2z1u2z1v2z1w2z1x2z1y2z053006300730083009300h300i300j301t301u301v301w301x30053106310731083109310h310i310j311t311u311v311w311x311y3106320732083209320i320j321s321t321u321v321w321x321y3206330733083309330i330j331s331t331v331w331x331y331z3306340734083409341s341t341v341w341x341y341z3406350735083509350a351t351w351x351y351z3509360a361x361y361z361x371y371z3720371y381z3820381y391z392039'],
  ['h12', '#3fe0d0', '042n042o052o062o072o032p042p052p062p072p032q042q052q062q022r032r042r052r012s022s032s042s052s012t022t032t042t012u022u032u042u022v032v042v1v2v022w032w042w052w1r2w1s2w1t2w1u2w1v2w022x032x042x052x1r2x1s2x1t2x1u2x1v2x022y032y042y052y1r2y1s2y1t2y1u2y022z032z042z052z1r2z1s2z1t2z033004301r301s30033104311r311s31043205321r32043305330534'],
  ['h12', '#7bf5e6', '022n032n022o032o012p022p012q022q012r'],
  ['h13', '#0f6d66', '02300231033203330434043505360i36243606370i371w372337073808380h381x38223809390h391x3921390a3a0h3a1x3a203a0b3b0i3b1x3b203b0c3c0i3c1x3c1z3c0d3d0e3d0i3d1y3d0f3e0g3e0h3e'],
  ['h13', '#10897f', '0a2z0b2z0a300b300c300d300e300a310b310c310d310e310f310g310a320b320c320d320e320f320g320h320a330b330c330d330e330f330g330h3320332133223323332433253326330a340b340c340d340e340f340g340h340i342034213422342334243425340b350c350d350e350f350g350h350i35203521352235233524350b360c360d360e360f360g360h3620362136223623360c370d370e370f370g370h37213722370d380e380f380g382138'],
  ['h13', '#20bcae', '012x062x012y062y072y082y012z062z072z082z092z05300630073008300930053106310731083109310h3106320732083209320i320j320k3206330733083309330i330j330k330l331y331z33273306340734083409340j340k340l341t341u341v341w341x341y341z342634053506350735083509350a350j350k350l351t351u351v351w351x351y351z35253506360736083609360a360j360k360l361t361w361x361y361z360737083709370a370b370j370k370l371x371y371z37203709380a380b380c380j380k380l381y381z3820380a390b390c390d390e390f390g390j390k390l391y391z3920390b3a0c3a0d3a0e3a0f3a0g3a0j3a0k3a0l3a1y3a1z3a0c3b0d3b0e3b0f3b0g3b0h3b0j3b0k3b0l3b1y3b1z3b0d3c0e3c0f3c0g3c0h3c0j3c0k3c0l3c1y3c0f3d0g3d0h3d0j3d0k3d0l3d0j3e0k3e0l3e0j3f0k3f0l3f0j3g0k3g0l3g0j3h0k3h'],
  ['h13', '#3fe0d0', '022x032x042x052x022y032y042y052y022z032z042z052z033004300331043104320532043305330534'],
  ['ink', '#080b0d', '180j190j180k1h0u1i0u1j0u1f0v1g0v1h0v1i0v1j0v1e0w1f0w1g0w1h0w1i0w1j0w1d0x1e0x1f0x1g0x1h0x1i0x1d0y1e0y1f0y1g0y1h0y1i0y1d0z1e0z1f0z1g0z1h0z1i0z1c111a121b121c1219131a131b131c13181419141a141b141c141715181519151a151b151716181619161a1616171717181719171a1716181718181819181j18161917191819161a171a181a171f1i1f1j1f1k1f171g1h1g1i1g1j1g1k1g171h181h1h1h1i1h1j1h1k1h161i171i181i191i1h1i1i1i1j1i161j171j181j191j1a1j0q1k151k161k171k181k191k1a1k1b1k141l151l161l171l181l191l1a1l1b1l1c1l1d1l131m141m151m161m171m181m191m1a1m1b1m1c1m1d1m1e1m121n131n141n151n161n171n181n191n1a1n1b1n1c1n1d1n131o141o151o161o171o181o191o1a1o1b1o131p141p151p161p171p181p131q141q151q161q171q131r141r151r161r171r0u1s0v1s0w1s121s131s141s151s161s171s181s1a1s1b1s0t1t0u1t0v1t0w1t0x1t0y1t111t121t131t141t151t161t171t181t191t0s1u0t1u0u1u0v1u0w1u0x1u0y1u0z1u101u111u121u131u141u151u161u171u0s1v0t1v0u1v0v1v0w1v0x1v0y1v0z1v101v111v121v131v141v151v0u1w0v1w0w1w0x1w0y1w0z1w101w111w0x1x0y1x0p200p210s2119211a211b211c210s220t220u220v220r270s270t270u271a271b271c270q280r280s280t280u281a281b281c281d280q290r290s290t291a291b291c291d291e290q2a0r2a0s2a0t2a1a2a1b2a1c2a1d2a1e2a0q2b0r2b0s2b0t2b1a2b1b2b1c2b1d2b1e2b0q2c0r2c0s2c0t2c1b2c1c2c1d2c1e2c0q2d0r2d0s2d0t2d1b2d1c2d1d2d1e2d0q2e0r2e0s2e0t2e1b2e1c2e1d2e1e2e1f2e0q2f0r2f0s2f1b2f1c2f1d2f1e2f1f2f0q2g0r2g0s2g1b2g1c2g1d2g1e2g1f2g0q2h0r2h0s2h1c2h1d2h1e2h1f2h0q2i0r2i0s2i1c2i1d2i1e2i1f2i0q2j0r2j0s2j1d2j1e2j1f2j1g2j0p2k0q2k0r2k0s2k1d2k1e2k1f2k1g2k0p2l0q2l0r2l0s2l1d2l1e2l1f2l1g2l0p2m0q2m0r2m1d2m1e2m1f2m1g2m0p2n0q2n0r2n1d2n1e2n1f2n1g2n0q2o0r2o1e2o1f2o1g2o0q2p0r2p1e2p1f2p1g2p1h2p0p2q0q2q0r2q1e2q1f2q1g2q1h2q0p2r0q2r0r2r1e2r1f2r1g2r1h2r0p2s0q2s0r2s1f2s1g2s0o2t0p2t0q2t0r2t1f2t0o2u0p2u0q2u0o2v0p2v0q2v0n2w0o2w0p2w0q2w0n2x0o2x0p2x0q2x0n2y0o2y0p2y0n2z0o2z0p2z0n300o300p300n310o310p311j311k311l310n320o321j321k321l321m320n330o331k331l331m330n340o341k341l341m341n340m350n350o351k351l351m351n350m360n360o361l361m361n360m370n371m371n370m380n381n380m390n390m3a0n3a0m3b0n3b0m3c0n3c0m3d0n3d0m3e0n3e0m3f0n3f1q3f0n3g1q3g0n3h0o3h0n3i0o3i0n3j0o3j0n3k0o3k1q3k1r3k1s3k1p3l1q3l1r3l1s3l0n3m0o3m0p3m1o3m1p3m1q3m1r3m1s3m0n3n0o3n0p3n0q3n1n3n1o3n1p3n1q3n1r3n1s3n0m3o0n3o0o3o0p3o0q3o1n3o1o3o1p3o1q3o1r3o0m3p0n3p0o3p0p3p0q3p0r3p1m3p1n3p1o3p1p3p1q3p1r3p0l3q0m3q0n3q0o3q0p3q0q3q0r3q1l3q1m3q1n3q1o3q1p3q1q3q1r3q0n3r'],
  ['ink', '#13171a', '1f051g051h061i0c1g0d1h0d1i0d1g0e1h0e1i0e1b0f1g0f1h0f190g1a0g1b0g1c0g1g0g170h180h190h1a0h1b0h150i160i170i180i190i1a0i1b0i140j150j160j170j1a0j1b0j140k150k160k170k190k1a0k1b0k150l160l170l180l190l1a0l1b0l140m150m180m190m1a0m150n1a0o1b0o1c0o1d0o1e0o1f0o1a0p1b0p1c0p1d0p1e0p1f0p190q1a0q1b0q1c0q1d0q1e0q1i0q1j0q1a0r1c0r1h0r1i0r1j0r140s150s1g0s1h0s1i0s1j0s130t140t150t1f0t1g0t1h0t1i0t1j0t120u130u140u1f0u1g0u120v130v180v190v1a0v1d0v1e0v110w120w130w170w180w190w1a0w1c0w1d0w110x120x1b0x1c0x100y110y120y1b0y1c0y100z110z1b0z1c0z0z1010101a101b101c101d100z11101119111a111b111d111e110y120z12181219121d121e121j120x130y130z13171318131d131e131h131i131j130x140y14161417141g141h141i141j140w150x1516151g151h151i151j150w160x16151616161g161h161i161j160w1715171g171h171i171j170w18141815181g181h181i18141915191g191h191i191j19141a151a1g1a1h1a1i1a1j1a0u1b0v1b141b151b161b171b181b1g1b1h1b1i1b1j1b0t1c0u1c0v1c0w1c0x1c141c151c161c171c181c191c1h1c1i1c1j1c0t1d0u1d0v1d0w1d141d151d161d171d181d191d1g1d1h1d1i1d1j1d1k1d0r1e0s1e141e151e161e171e181e191e1a1e1g1e1h1e1i1e1j1e1k1e0r1f0s1f131f141f151f161f181f191f1a1f1g1f1h1f0q1g0r1g131g141g151g161g181g191g1a1g1b1g1f1g1g1g0p1h0q1h0r1h131h141h151h161h191h1a1h1b1h1f1h1g1h0p1i0q1i131i141i151i1a1i1b1i1c1i1e1i1f1i1g1i1k1i0o1j0p1j0q1j131j141j151j1b1j1c1j1d1j1e1j1f1j1k1j1l1j0n1k0o1k0p1k121k131k141k1c1k1d1k1e1k1k1k1l1k0n1l0o1l0p1l0q1l111l121l131l1e1l1f1l1k1l1l1l0n1m0o1m0p1m0r1m0z1m101m111m121m1f1m1l1m0m1n0n1n0o1n0z1n101n111n1e1n1f1n0n1o0z1o101o111o121o1c1o1e1o1f1o0w1p0x1p0y1p0z1p101p111p121p1a1p1b1p1c1p1d1p1e1p1f1p0v1q0w1q0x1q0y1q111q121q191q1a1q1b1q1c1q1d1q1e1q1f1q1l1q1m1q0l1r0o1r0p1r0q1r0r1r0s1r0t1r0u1r0v1r0w1r0x1r0y1r111r121r181r191r1a1r1b1r1c1r1d1r1e1r1f1r1l1r1m1r0k1s0l1s0p1s0q1s0r1s0s1s0t1s0x1s0y1s0z1s101s111s191s1e1s1f1s1m1s0j1t0k1t0l1t0m1t0q1t0r1t0s1t0z1t101t1e1t1f1t0i1u0j1u0k1u0l1u0m1u0n1u0r1u1e1u1f1u0h1v0i1v0j1v0k1v0l1v0m1v0n1v0o1v1e1v1f1v0h1w0i1w0j1w0k1w0l1w0m1w0n1w0o1w0p1w1d1w1e1w1f1w1n1w0j1x0k1x0l1x0m1x0n1x0o1x0p1x0q1x1d1x1e1x1f1x1m1x1n1x1o1x0i1y0k1y0l1y0m1y0n1y0o1y0p1y0q1y0r1y0s1y1b1y1d1y1e1y1f1y1n1y1o1y0i1z0j1z0k1z0m1z0n1z0o1z0p1z0q1z0r1z0s1z0t1z0u1z0v1z191z1a1z1b1z1c1z1d1z1e1z1f1z1n1z1o1z0i200j200k200m200n200o200q200r200s200t200u200v2016201720182019201a201b201c201d201e201f201n201o200m210n210o210q210r210t210u210v211321142115211621172118211d211e211f211g211m211n210q220r221422152216221722182219221a221f221g221h221i221j221k221l221o220u23182319231a231b231c231d231g231l231m230t240u241a241b241c241d241g241j241k241m240s250t250u2519251a251b251c251d251g251j251k250q260r260s260t260u26182619261a261b261c261d260p270q271727182719271d270o280p2816281728182819281e280o290p2916291729182919290o2a0p2a162a172a182a192a0o2b0p2b172b182b192b0o2c0p2c182c192c1a2c0o2d0p2d182d192d1a2d1f2d0o2e0p2e182e192e1a2e0o2f0p2f182f192f1a2f0o2g0p2g182g192g1a2g0o2h0p2h192h1a2h1b2h0o2i0p2i182i192i1a2i1b2i0o2j0p2j192j1a2j1b2j1c2j0o2k192k1a2k1b2k1c2k0n2l0o2l1a2l1b2l1c2l0n2m0o2m192m1a2m1b2m1c2m0o2n1a2n1b2n1c2n0o2o0p2o1a2o1b2o1c2o1d2o0o2p0p2p1a2p1b2p1c2p1d2p0n2q0o2q1b2q1c2q1d2q0n2r0o2r1b2r1c2r1d2r0n2s0o2s1b2s1c2s1d2s1e2s1h2s0n2t1c2t1d2t1e2t1g2t1h2t1i2t0m2u0n2u1c2u1d2u1e2u1f2u1g2u1h2u1i2u0m2v0n2v1d2v1e2v1f2v1g2v1h2v1i2v1j2v0m2w1d2w1e2w1f2w1g2w1h2w1i2w1j2w0l2x0m2x1e2x1f2x1g2x1h2x1i2x1j2x1k2x0l2y0m2y1e2y1f2y1g2y1h2y1i2y1j2y1k2y0l2z0m2z1f2z1g2z1h2z1i2z1j2z1k2z1l2z0l300m301f301g301h301i301j301k301l300l310m311g311h311i311m310l320m321g321h321i320l330m331h331i331j330l340m341h341i341j340l351i351j350k360l361i361j361k360k370l371j371k371l370j380k380l381j381k381l381m381o380j390k390l391k391l391m391n391o390j3a0k3a0l3a1k3a1l3a1m3a1n3a1o3a0j3b0k3b0l3b1l3b1m3b1n3b1o3b1p3b0j3c0k3c0l3c1l3c1m3c1n3c1o3c1p3c0j3d0k3d0l3d1l3d1m3d1n3d1o3d1p3d0j3e0k3e0l3e1m3e1n3e1o3e1p3e1q3e0j3f0k3f0l3f1m3f1n3f1o3f1p3f0j3g0k3g0l3g0m3g1m3g1n3g1o3g1p3g0k3h0l3h0m3h1m3h1n3h1o3h1p3h1q3h0k3i0l3i0m3i1n3i1o3i1p3i1q3i1r3i0j3j0k3j0l3j0m3j1o3j1p3j1q3j1r3j0j3k0k3k0l3k0m3k1o3k1p3k0j3l0k3l0l3l0m3l0n3l0o3l0p3l1n3l1o3l0k3m0l3m0m3m1n3m0k3n0l3n0m3n1l3n1m3n0k3o0l3o1k3o1l3o1m3o0k3p0l3p1k3p1l3p0k3q1k3q'],
  ['ink', '#1d242a', '1g001h001f011g011f02100311031e031f030z041e041f040z051h0a1i0a1g0b1h0b1i0b1f0c1g0c1h0c130d140d150d120e130e140e150e160e190e1a0e130f140f150f160f180f190f1a0f130g140g150g160g170g180g1f0g130h140h150h160h130i140i1b0m1c0m1d0m1e0m190n1a0n1b0n1c0n1d0n1e0n1f0n170o180o190o1g0o160p170p180p190p1g0p1h0p1i0p150q160q1f0q1g0q1h0q140r150r190r1e0r1f0r1g0r130s190s1a0s1d0s1e0s1f0s110t120t180t190t1a0t1b0t1e0t100u110u170u180u190u1a0u1b0u1c0u1d0u1e0u100v110v160v170v1b0v1c0v100w160w1b0w100x1a0x0z0y1a0y0z0z1a0z0y1019100x110y11171118111f111i111j110x12161217121f121g121h121i120w1316131f131g130w1415141e141f14141515151e151f150v1614161e161f160v17131714171e171f170u180v1813181e181f180u190v1913191e191f190t1a0u1a0v1a131a1e1a1f1a0t1b121b131b1e1b1f1b0s1c121c131c1e1c1f1c1g1c0r1d0s1d121d131d1e1d1f1d0q1e111e121e131e1e1e1f1e0p1f0q1f111f121f1e1f1f1f0o1g0p1g111g121g1e1g0o1h111h121h1e1h0n1i0o1i111i121i0m1j0n1j101j111j121j0m1k0z1k101k111k0l1l0m1l0x1l0y1l0z1l101l0k1m0l1m0y1m0k1n0l1n0q1n0r1n0w1n0x1n0y1n1l1n0j1o0k1o0l1o0o1o0p1o0q1o0r1o0v1o0w1o0x1o1l1o1m1o0j1p0k1p0n1p0o1p0p1p0q1p0r1p0s1p0u1p0v1p1l1p1m1p0j1q0k1q0o1q0p1q0q1q0r1q0s1q0t1q0u1q101q0i1r0j1r0k1r0z1r101r0i1s0j1s0h1t0i1t1d1t1m1t1n1t0g1u0h1u1d1u1m1u1n1u0g1v1d1v1m1v1n1v1a1w1m1w1a1x1b1x181y191y1a1y151z161z171z181z1320142015200m220m230p230q230p240q240r240s241724182419240m250n250o250p250q250r25172518250m260n260o260p261526162617260m270n270o27152716270m280n280m290n290m2a0n2a0m2b0n2b0m2c0n2c172c0m2d0n2d172d0m2e0n2e172e0m2f0n2f0m2g0n2g0m2h0n2h182h0m2i0n2i0m2j0n2j0m2k0n2k0m2l192l0m2m0m2n0n2n0m2o0n2o0m2p0n2p0l2q0m2q0l2r0m2r0l2s0m2s0l2t0m2t0k2u0l2u0k2v0l2v0k2w0l2w0k2x0k2y0k2z0k300k310k320k330j340k340j350k350j360j370j3h0j3i1m3i1m3j1n3j1m3k1n3k1l3l1m3l1l3m1m3m1k3n'],
  ['ink', '#2f3a42', '1e0812091e091f09120a130a160a1f0a1g0a120b130b160b170b1f0b120c130c140c170c180c120d170d180d190d180e170f1d0k1e0k1d0l1e0l120r130r110s120s180s100t170t1c0t1d0t150x150y160y170y180y190y150z160z170z180z190z141015101610171018101411151116111g111h111412151213131413151313141414121513151216131612171118121811191219111a121a101b111b101c111c101d111d101e0z1f101f0n1g0z1g101g0m1h0n1h0z1h101h0m1i0z1i101i0y1j0z1j0y1k0w1m0u1n0v1n0t1o0u1o0i1p0t1p0i1q0h1r0h1s171x181x191x161y171y131z141z0n230o230m240n240o2414241524162415251625'],
  ['trim', '#20bcae', '11161117101810190z1a101a0z1b0y1g0w1h0x1h0y1h0v1i0w1i0x1i0y1i0u1j0v1j0w1j0x1j0u1k0v1k0w1k0x1k0t1l0u1l0v1l0w1l0t1m0u1m0v1m0x1m0s1n0t1n1k1n0s1o1k1o1j1p1k1p1k1q1k1s1l1s1k1t1l1t1k1u1l1u1k1v1l1v1k1w1l1w1k1x1l1x151y1j1y1k1y1l1y1m1y111z121z1i1z1j1z1k1z1l1z1m1z1i201j201k201l201m201h211i211j211k211l211m220w2n0v2o0w2o0u2p0v2p0w2p0u2q0v2q0w2q0t2r0u2r0v2r0w2r0s2s0t2s0w2s0x2s0s2t0t2t0r2u0s2u0r2v0x2v0y2v0y2w0p3r0q3r0r3r1p3r1q3r1r3r0p3s0q3s1p3s1q3s'],
  ['trim', '#3fe0d0', '170q180q160r170r180r1b0r1d0r160s170s1b0s1c0s160t150u160u140v150v140w150w130x140x160x170x180x190x130y140y130z140z121013101f101g101h101i101j1012111311111212121312101311131213101411141214101511150z1610160z1710170y180z180x190y190z190w1a0x1a0y1a0w1b0x1b0y1b0y1c0z1c0x1d0y1d0z1d0x1e0y1e0z1e0w1f0x1f0y1f0w1g0x1g0u1h0v1h0u1i0t1j1j1j0r1k0s1k0t1k1j1k0r1l0s1l1i1l1j1l0q1m0s1m1h1m1i1m1j1m1k1m0p1n1h1n1i1n1j1n0y1o1h1o1i1o1j1o0m1p191p1h1p1i1p0l1q0m1q0n1q0z1q181q1h1q1i1q1j1q0m1r0n1r1h1r1i1r1j1r1k1r0m1s0n1s0o1s1c1s1d1s1h1s1i1s1j1s0n1t0o1t0p1t1a1t1b1t1c1t1h1t1i1t1j1t0o1u0p1u0q1u181u191u1a1u1b1u1c1u1h1u1i1u1j1u0p1v0q1v0r1v161v171v181v191v1a1v1b1v1h1v1i1v1j1v0q1w0r1w0s1w0t1w121w131w141w151w161w171w181w191w1h1w1i1w1j1w0r1x0s1x0t1x0u1x0v1x0w1x0z1x101x111x121x131x141x151x161x1h1x1i1x1j1x0t1y0u1y0v1y0w1y0x1y0y1y0z1y101y111y121y131y141y1g1y1h1y1i1y0w1z0x1z0y1z0z1z101z1g1z1h1z0w200x201g201h200w210x211o210w221b221c221d221e221n220v230w2314231523162317231h231j230v240w240v250w250v260w260v270w270v280w280u290v290u2a0v2a0u2b0v2b0u2c0v2c0u2d0v2d0u2e0v2e0t2f0u2f0v2f0t2g0u2g0v2g0t2h0u2h0v2h0t2i0u2i0v2i0t2j0u2j0v2j0t2k0u2k0v2k0t2l0u2l0v2l0t2m0u2m0v2m0s2n0t2n0u2n0v2n0s2o0t2o0u2o0s2p0t2p0s2q0t2q0s2r0w2t0x2t0x2u1s3o0k3r0l3r0m3r0o3r1k3r1l3r1m3r1n3r1o3r0l3s0m3s0n3s0o3s1m3s1n3s1o3s'],
  ['trim', '#7bf5e6', '120z11101e10111110120z140y150z150y160x170y170x180w190t1e0u1e0v1e0w1e0t1f0u1f0v1f0s1g0t1g0u1g0v1g0s1h0t1h0r1i0s1i0t1i0r1j0s1j1g1j1h1j1i1j1f1k1g1k1h1k1i1k1g1l1h1l1g1m1g1n0m1o1g1o0l1p1g1p1g1q1g1r1g1s1g1t1g1u1g1v1g1w1g1x0s2m'],
]

/** One `<path>` of run-merged cells. See the encoding notes in `figure`. */
function runPath(cells: ReadonlyArray<readonly [number, number]>, name: string, fill: string): string {
  let d = ''
  let atCol = 0
  let atRow = 0
  let runCol = -1
  let runRow = -1
  let runLen = 0
  const flush = () => {
    if (runLen === 0) return
    // The first move carries the half-cell offset that centres the stroke; the rest are whole cells.
    // A relative `m` starts from the CURRENT POINT, and after `h${runLen}` that is the run's END, not
    // its start — so the cursor is tracked at the end. Measuring from the start instead shifts every
    // run by the length of the one before it, which shreds the figure into diagonal streaks.
    d += d === '' ? `M${runCol} ${runRow + 0.5}h${runLen}` : `m${runCol - atCol} ${runRow - atRow}h${runLen}`
    atCol = runCol + runLen
    atRow = runRow
    runLen = 0
  }
  for (const [col, row] of cells) {
    if (runLen > 0 && row === runRow && col === runCol + runLen) {
      runLen++
    } else {
      flush()
      runCol = col
      runRow = row
      runLen = 1
    }
  }
  flush()
  return d === '' ? '' : `<path class="${name}" stroke="${fill}" d="${d}"/>`
}

/**
 * Cells the sampler got wrong. It read two dark pixels in the middle of her collar and tie as shading,
 * and at this size a dark cell ringed by mint does not read as shading — it reads as a hole punched
 * through the cloth. They are painted back in mint here rather than deleted, because deleting them would
 * show the hair behind instead. Patched after the layers are drawn, so these land on top.
 */
const MENDED: ReadonlyArray<readonly [number, number]> = [
  [48, 27],
  [41, 33],
]

/**
 * The figure. Only her hair moves — it is cut into bands by how far each part sits from the crown, so the
 * tips swing hard and the roots barely leave her head. An arm that came up to her ear and a head that
 * tilted with it were both built here and then taken out again: they worked, but they drew the eye away
 * from a scene that is meant to sit quietly behind a conversation.
 *
 * Cells are packed in row-major order, so neighbours on a row are adjacent in the string, and one shape
 * per horizontal RUN instead of one per cell is what keeps this scene inside the size a window will draw:
 * as separate boxes the figure alone outweighed every other theme's whole backdrop. A run is a stroked
 * line, not a filled box — every run is exactly one cell tall, so a line down the cell's middle at
 * stroke-width 1 covers it precisely, and `m-5 1h3` costs seven characters where the box `m-5 1h3v1h-3`
 * costs twelve.
 */
function figure(): string {
  let markup = ''
  for (const [name, fill, packed] of PIXELS) {
    const cells: Array<readonly [number, number]> = []
    for (let i = 0; i < packed.length; i += 4) {
      cells.push([parseInt(packed.slice(i, i + 2), 36), parseInt(packed.slice(i + 2, i + 4), 36)])
    }
    markup += runPath(cells, name, fill)
  }
  markup += runPath([...MENDED].sort((a, b) => a[1] - b[1] || a[0] - b[0]), 'trim', '#3fe0d0')
  // Her hair masses are NOT outlined where they overlap. Drawing the band boundaries in the darkest mint
  // was tried twice — once along the crown, once around the whole head — and both times it put hard lines
  // through hair that is meant to read as one soft mass. The bands are a flutter rig, not a drawing.
  return `<g fill="none" stroke-width="1" transform="translate(${FIG_COL} ${FIG_ROW})">${markup}</g>`
}

/**
 * One flutter keyframe per band: the swing grows toward the tips and the start time slides, so the wave
 * travels. Each band steps through whole cells, because a band sliding smoothly would sit off-grid for most
 * of its travel and shimmer against a backdrop that never does.
 */
function flutter(): string {
  let css = ''
  for (let b = 0; b < BANDS; b++) {
    const cells = Math.round(Math.pow(b / (BANDS - 1), 1.7) * REACH)
    const tag = String(b).padStart(2, '0')
    css +=
      `@keyframes fl${tag}{from{transform:translate(${-cells}px,${Math.round(cells * 0.3)}px)}` +
      `to{transform:translate(${cells}px,${-Math.round(cells * 0.3)}px)}}` +
      `.h${tag}{animation:fl${tag} ${SWEEP}s steps(${Math.max(1, cells * 2)}) infinite alternate;` +
      `animation-delay:-${(b * LEAD).toFixed(2)}s}`
  }
  return css
}

/** Miku Aero: a Frutiger Aero sky in pixels, with the diva standing in it. For light windows. */
export function mikuAeroSvg(): string {
  // The body is built FIRST: it is what fills the paint registry that `paintCss` then reads.
  const body = `${sky()}
${sun()}
${streaks()}
${clouds()}
${land()}
${water()}
${shadow()}
${rocks()}
${bubbles()}
${farFish()}
${veil()}
${halo()}
${figure()}
${nearFish()}
${droplets()}
${sparkles()}
${flares()}
${shafts()}`
  // NOTHING here may declare `shape-rendering`, and nor may the root as an attribute. The window applies
  // every static rule of such a stylesheet and then runs NO animation in the document, with no error: the
  // backdrop draws perfectly and stands completely still. Pixel edges are antialiased without it anyway.
  const style = `${paintCss()}${ruleCss()}${motionCss()}
${flutter()}
/* The surface never stops moving: six interleaved sets of dashes, each on its own clock, so the glitter
   crawls across the water instead of sitting on it. They SLIDE as well as brighten — brightness alone
   just made a few highlights blink on and off, which is not what water does. Stepped, because the slide
   has to land on whole cells or the dashes blur into streaks. */
.ripple{animation-timing-function:steps(4);animation-iteration-count:infinite;animation-direction:alternate}
/* Three travels, handed out round-robin, so the sets do not slide as one sheet. All of them step in
   whole cells; a sub-cell slide smears the dashes into streaks. */
.rp0{animation-name:rp0}
@keyframes rp0{from{transform:translateX(-2px);opacity:0.45}to{transform:translateX(2px);opacity:1}}
.rp1{animation-name:rp1}
@keyframes rp1{from{transform:translateX(5px);opacity:1}to{transform:translateX(-5px);opacity:0.5}}
.rp2{animation-name:rp2}
@keyframes rp2{from{transform:translateX(-8px);opacity:0.55}to{transform:translateX(8px);opacity:1}}
.twinkle{animation-name:blink;animation-timing-function:steps(2);animation-iteration-count:infinite;animation-direction:alternate}
@keyframes blink{from{opacity:0.15}to{opacity:1}}
.tailflick{transform-box:fill-box;transform-origin:left center;animation:tailflick 0.5s steps(3) infinite alternate}
@keyframes tailflick{from{transform:translateY(-1px) scaleX(1)}to{transform:translateY(1px) scaleX(0.62)}}
/* The goldfish sprite is drawn nose-LEFT, so scaleX(1) faces left and must travel in -x, while
   scaleX(-1) faces right and must travel in +x. Both paths below used to do the opposite at every stage,
   which is why the fish swam backwards; the flips now sit exactly on the turns, where the fish pauses for
   a beat first. Step counts are set so one step is about one cell of travel, give or take. */
/* BOTH fish must pin their own transform origin. A horizontal flip with no origin mirrors about the
   middle of the SVG's view box, not about the fish — so at every turn the sprite was hurled to the far side of
   the canvas and had to race back. It looked like the animation restarting, and it survived three rounds
   of checks because those compared the transform's translate against its facing and never asked where the
   fish actually WAS on screen. fill-box ties the origin to the sprite's own box. */
.approach,.roam{transform-box:fill-box;transform-origin:50% 50%}
/* The fish glide; everything else in this scene steps. A stepped fish does not read as slower, it reads
   as FASTER — at half a second a tread it teleports a cell at a time, and the eye takes each jump for
   speed however long the gap between them is. Their tails still flick in steps, which is what keeps them
   looking drawn rather than tweened. */
.approach{animation-name:approach;animation-timing-function:linear;animation-iteration-count:infinite}
@keyframes approach{0%{transform:translate(0,0) rotate(-3deg) scaleX(-1)}
13%{transform:translate(7px,3px) rotate(4deg) scaleX(-1)}
28%{transform:translate(15px,-2px) rotate(-5deg) scaleX(-1)}
42%{transform:translate(23px,4px) rotate(4deg) scaleX(-1)}
47%{transform:translate(26px,5px) rotate(0deg) scaleX(-1)}
51%{transform:translate(26px,5px) rotate(0deg) scaleX(1)}
64%{transform:translate(19px,0px) rotate(-4deg) scaleX(1)}
79%{transform:translate(10px,6px) rotate(4deg) scaleX(1)}
93%{transform:translate(2px,1px) rotate(-3deg) scaleX(1)}
97%{transform:translate(0,0) rotate(0deg) scaleX(1)}
100%{transform:translate(0,0) rotate(-3deg) scaleX(-1)}}
.roam{animation-name:roam;animation-timing-function:linear;animation-iteration-count:infinite}
@keyframes roam{0%{transform:translate(0,0) rotate(-3deg) scaleX(1)}
28%{transform:translate(-22px,6px) rotate(4deg) scaleX(1)}
33%{transform:translate(-24px,7px) rotate(0deg) scaleX(1)}
37%{transform:translate(-24px,7px) rotate(0deg) scaleX(-1)}
66%{transform:translate(6px,-4px) rotate(-5deg) scaleX(-1)}
72%{transform:translate(8px,-4px) rotate(0deg) scaleX(-1)}
76%{transform:translate(8px,-4px) rotate(0deg) scaleX(1)}
100%{transform:translate(0,0) rotate(-3deg) scaleX(1)}}
/* The shafts breathe rather than blink: .pulse drops to a quarter, which on something already this
   faint leaves nothing on screen at all. */
.beam{animation-name:breathe;animation-timing-function:steps(4);animation-iteration-count:infinite;animation-direction:alternate}
@keyframes breathe{from{opacity:0.5}to{opacity:1}}
.pulse{animation-name:pulse;animation-timing-function:steps(3);animation-iteration-count:infinite;animation-direction:alternate}
@keyframes pulse{from{opacity:0.25}to{opacity:1}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" font-family="monospace" color="#888"><style>${style}</style><defs>${ditherDefs()}</defs>
<g transform="scale(${PX})">${body}</g>
</svg>`
}
