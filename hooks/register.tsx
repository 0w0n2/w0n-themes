import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import {
  NIGHT_GLASS,
  NIGHT_ID,
  SHOW_SUFFIXES,
  WORD,
  nightScene,
  sceneWithFireworks,
  themeIdOfShow,
} from './fireworks'
import { keyToWrite, keysToClear, keysToRead, projectKeyFor } from './project-key'
import type { KeptKey, KeyEngine } from './project-key'
import { THEMES, sceneFault, sceneOf } from './themes'
import type { Theme } from './themes'
import type { ThemeChoice } from '../types'

const PLUGIN = 'w0n-themes'
const CARD = 'theme-card'
// Named after the plugin on purpose: a command name goes to whichever plugin registers it first, so the forked `custom-theme` and `fireworks` names would make this uninstallable beside theme-examples.
const COMMAND = 'w0n-themes'
const PREVIEW_MS = 20_000
const SHOW_MS = 7000
// Absent means OFF, the opposite of the forked plugin: a backdrop that starts flashing because Claude happened to say "merged" is not a safe surprise for everybody.
const AUTO_KEY = 'fireworks:auto'
const SESSION_PREFIX = 'session:'
// Past this many stored session choices, the one written longest ago is dropped.
const SESSIONS_KEPT = 200
// Worded to hold whether or not the theme actually shows, and never to say why: the engine's `isDrawn` reflects only the windows attached at the moment of the set.
const UNSHOWN = 'If no theme shows, this window may not draw themes yet'
const KEPT_UNSHOWN = `${UNSHOWN}. Your choice is saved.`
const SHOW_UNSHOWN = 'If none shows, this window may not draw them yet.'
// Module state resets on reload, and so does a show in flight. 'starting' is held from the tick a show is asked for until its timer stands.
let showEnding: Timer | 'starting' | undefined
let showCount = 0
let previewEnding: Timer | undefined
// Must equal "name" in .claude-plugin/plugin.json: only the named plugin may write the value. Both names are string literals because the loader scans for them.
const choice = atom({ plugin: 'w0n-themes', key: 'choice' } as const, {}, {
  shape: 'choice-1',
})

/** What a set comes to on any engine, as far as this mod reads it: drawn or not. */
type BackdropAnswer = { isDrawn: boolean }
type BackdropChoice = {
  id: string
  glass: Theme['glass']
  colorScheme?: Theme['window']
  colors?: Theme['colors']
}
/** The engines this mod meets, for the type checker alone: the theme noun or the older call may be absent. */
type AnyEngine = {
  theme?: { set(args: unknown): Promise<BackdropAnswer>; clear(): Promise<unknown> }
  // `toast` is here only so this type shares a member with every engine's ui noun; one that shares none is refused.
  ui: { toast: EngineInterface['ui']['toast']; backdrop?(args: BackdropChoice | undefined): Promise<BackdropAnswer> }
}
// Which backdrop call this engine takes, learnt at the first set that can tell. Relearnt after a reload.
let taken: 'beside' | 'nested' | 'older' | 'none' | undefined

/**
 * Fall through to the next way only when the engine lacks the call (reaching for it throws TypeError) or refuses the shape. Rethrow anything else.
 *
 * Call each one inline: the engine loads a module only where the call on its handle is called on the spot.
 */
function isNotThisEnginesWay(error: unknown, member?: string): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      (error.message.includes('does not know the attribute') || (member !== undefined && error.message.includes(member))))
  )
}

/** Sets a backdrop by whichever call the engine has, newest first. The scene name goes under `scene` and `id` at once, because each kind of engine drops the member it does not know. */
async function setByAWay($: AnyEngine, backdrop: BackdropChoice): Promise<BackdropAnswer | undefined> {
  if (taken === undefined || taken === 'beside') {
    try {
      const set = await $.theme!.set({
        backdrop: { scene: backdrop.id, id: backdrop.id, glass: backdrop.glass },
        ...(backdrop.colors !== undefined && { colors: backdrop.colors }),
        ...(backdrop.colorScheme !== undefined && { overrideColorScheme: backdrop.colorScheme }),
      })

      // Nothing is learnt without a colorScheme to hand over: this shape is the next way's too.
      if (backdrop.colorScheme !== undefined) {
        taken = 'beside'
      }

      return set
    } catch (error) {
      if (!isNotThisEnginesWay(error, 'overrideColorScheme')) throw error
    }
  }

  if (taken === undefined || taken === 'nested') {
    try {
      const set = await $.theme!.set({
        backdrop: {
          id: backdrop.id,
          glass: backdrop.glass,
          ...(backdrop.colorScheme !== undefined && { colorScheme: backdrop.colorScheme }),
        },
        ...(backdrop.colors !== undefined && { colors: backdrop.colors }),
      })
      taken = 'nested'

      return set
    } catch (error) {
      if (!isNotThisEnginesWay(error)) throw error
    }
  }

  if (taken === undefined || taken === 'older') {
    try {
      // The older call carries no palette, so an engine that lands here draws the scene with the app's own colours.
      const set = await $.ui.backdrop!({ id: backdrop.id, glass: backdrop.glass })
      taken = 'older'

      return set
    } catch (error) {
      if (!isNotThisEnginesWay(error)) throw error
    }
  }

  return undefined
}

/** A learnt way is the only one tried; if the engine stops taking it, all the ways are walked again. An engine with none of them draws nothing, and the answer says so. */
async function setBackdrop($: AnyEngine, backdrop: BackdropChoice): Promise<BackdropAnswer> {
  if (taken === 'none') {
    return { isDrawn: false }
  }

  const learnt = taken
  const set = await setByAWay($, backdrop)

  if (set !== undefined) {
    return set
  }

  if (learnt !== undefined) {
    taken = undefined

    const again = await setByAWay($, backdrop)

    if (again !== undefined) {
      return again
    }
  }

  taken = 'none'

  return { isDrawn: false }
}

/** Clears the backdrop by whichever call this engine has; an engine with neither is left alone. */
async function clearBackdrop($: AnyEngine): Promise<void> {
  try {
    await $.theme!.clear()

    return
  } catch (error) {
    if (!isNotThisEnginesWay(error)) throw error
  }

  try {
    await $.ui.backdrop!(undefined)
  } catch (error) {
    if (!isNotThisEnginesWay(error)) throw error
  }
}

/** The scene name as the Backdrop hook receives it: `scene` on the newest engines, `id` on the ones before. A hook knowing one name alone would silently find no theme on the others. */
function sceneNameOf(props: { scene?: unknown; id?: unknown }): string | undefined {
  if (typeof props.scene === 'string') {
    return props.scene
  }

  return typeof props.id === 'string' ? props.id : undefined
}

function themeOf(id: string | undefined): Theme | undefined {
  return THEMES.find(theme => theme.id === id)
}

/** A name as typed, a title as shown and an id all come to one key: lower case, each run of anything else a hyphen. */
function keyOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** The theme a person named: by its id or its title, in any case, with spaces or hyphens between the words. */
function themeNamed(text: string): Theme | undefined {
  const key = keyOf(text)

  return THEMES.find(theme => theme.id === key || keyOf(theme.title) === key)
}

/** Levenshtein distance: how many single-letter edits turn one word into the other. */
function editsBetween(from: string, to: string): number {
  let row = Array.from({ length: to.length + 1 }, (_, column) => column)

  for (let line = 1; line <= from.length; line += 1) {
    const next = [line]

    for (let column = 1; column <= to.length; column += 1) {
      const swap = (row[column - 1] ?? 0) + (from[line - 1] === to[column - 1] ? 0 : 1)

      next.push(Math.min(swap, (row[column] ?? 0) + 1, (next[column - 1] ?? 0) + 1))
    }

    row = next
  }

  return row[to.length] ?? 0
}

/** The theme nearest a mistyped name: a few edits away first (one id can be the start of another), then the longest id the typed name starts with, then the first id that starts with what was typed. */
function nearestTheme(text: string): Theme | undefined {
  const key = keyOf(text)

  if (key === '') return undefined

  const byEdits = THEMES.map(theme => ({ theme, edits: editsBetween(key, theme.id) })).sort(
    (one, other) => one.edits - other.edits,
  )
  const nearest = byEdits[0]

  if (nearest !== undefined && nearest.edits <= Math.max(2, Math.floor(key.length / 3))) {
    return nearest.theme
  }

  const startsIt = THEMES.filter(theme => key.startsWith(theme.id)).sort(
    (one, other) => other.id.length - one.id.length,
  )

  return startsIt[0] ?? THEMES.find(theme => theme.id.startsWith(key))
}

/** The two kinds of window, in the order the list and the card show them. */
const WINDOWS = ['dark', 'light'] as const

/** The themes made for one kind of window, a row each: the name to type, its title, what it is, and its twin's name. */
function rowsFor(window: Theme['window']): string[] {
  return THEMES.filter(theme => theme.window === window).map(theme => {
    const twin = themeOf(theme.twin)

    return `  ${theme.id}: ${theme.title}. ${theme.blurb}${twin === undefined ? '' : ` (for ${twin.window} windows: ${twin.id})`}`
  })
}

/** Every theme by the name to type, under the window it is made for. */
function themeList(): string {
  return [
    `w0n-themes (${THEMES.length}):`,
    ...WINDOWS.flatMap(window => [`For ${window} windows:`, ...rowsFor(window)]),
    `Apply one with /${COMMAND} <name>, add "session" for this session only, /${COMMAND} off clears it.`,
    `/${COMMAND} fireworks sets off a show; "auto on" after it starts one whenever Claude says "merged".`,
  ].join('\n')
}

/**
 * Shows a theme behind the chat, or clears with none.
 *
 * A clear takes away whatever theme stands, whichever mod set it. Pass none only on a person's ask, never over a window it left bare.
 */
async function show($: EngineInterface, id: string | undefined): Promise<BackdropAnswer | undefined> {
  const theme = themeOf(id)

  if (theme === undefined) {
    await clearBackdrop($)

    return undefined
  }

  return setBackdrop($, { id: theme.id, glass: theme.glass, colorScheme: theme.window, colors: theme.colors })
}

const PROJECT_PREFIX = 'project:'

// Cached against the root it was made for, and remade only when the root moves. A reload starts it over.
let keptProjectKey: KeptKey | null = null
// Logged again only when it changes, so a turn's start adds no line.
let toldKeyStep: string | undefined

/** Which of the seven steps gave the project's key, to the DEBUG log alone: without the option the engine appends the line to the person's transcript. */
async function tellKeyStep($: EngineInterface, step: string): Promise<void> {
  if (step === toldKeyStep) {
    return
  }

  toldKeyStep = step

  try {
    await $.ui.log(`the project's key came by ${step}`, { to: 'debug' })
  } catch {
    // An engine without that call, or one that refuses it: nothing more to tell.
  }
}

/** The engine's four calls as project-key.ts asks for them: the repo root alone, and `dir` renamed `directory`. */
function keyEngineOf($: EngineInterface): KeyEngine {
  return {
    root: () => $.session.root(),
    cwd: () => $.session.cwd(),
    repo: async () => (await $.session.repo())?.root ?? null,
    stat: async path => {
      const { kind, realPath } = await $.fs.stat(path, { resolve: true })
      const told = kind === 'dir' ? 'directory' : kind

      return realPath === undefined ? { kind: told } : { kind: told, realPath }
    },
  }
}

/** The keys a project's choice is read under, in order; the one it is written under; the ones a clear takes away. */
type ProjectKeys = { read: string[]; write: string; clear: string[] }

/** One choice per project: a session in a linked git worktree shares the key of its folder in the main tree. Any fault falls back to the key every earlier version used. */
async function projectKeys($: EngineInterface): Promise<ProjectKeys> {
  try {
    const found = await projectKeyFor(keyEngineOf($), PROJECT_PREFIX, keptProjectKey)

    keptProjectKey = found.kept
    await tellKeyStep($, found.answer.step)

    return { read: keysToRead(found.answer), write: keyToWrite(found.answer), clear: keysToClear(found.answer) }
  } catch {
    const today = `${PROJECT_PREFIX}${await $.session.root()}`

    await tellKeyStep($, 'fault')

    return { read: [today], write: today, clear: [today] }
  }
}

/** What the store keeps for one session: its own theme's id, or null where it chose none. */
type SessionChoice = { theme: string | null }

/** An id an engine may not offer: a fault counts as no answer. */
async function orNothing(ask: () => Promise<string | undefined>): Promise<string | undefined> {
  try {
    return await ask()
  } catch {
    return undefined
  }
}

/** Where a session's own choice is stored: one key per row in the desktop app, else one per Claude Code session. With neither id the choice lasts only as long as this process. */
async function sessionKey($: EngineInterface): Promise<string | undefined> {
  const id =
    // The desktop app's row id, unpromised but it outlives /clear and an archive. Unset in the terminal.
    (await orNothing(() => $.env.get('CLAUDE_CODE_HOST_SESSION_ID'))) ||
    (await orNothing(() => $.session.id()))

  return id === undefined || id === '' ? undefined : `${SESSION_PREFIX}${id}`
}

/** The choice stored under a session's key, or nothing: none was made, or its theme is no longer in the table. */
async function sessionChoice($: EngineInterface, key: string): Promise<SessionChoice | undefined> {
  const stored = await $.store.get(key)

  if (typeof stored !== 'object' || stored === null || !('theme' in stored)) {
    return undefined
  }

  const theme = stored.theme

  return theme === null || (typeof theme === 'string' && themeOf(theme) !== undefined) ? { theme } : undefined
}

/** The key is deleted before it is written so the store's order is the order of last writes, and the cap then drops the session that chose longest ago. */
async function keepForSession($: EngineInterface, key: string, id: string | undefined): Promise<void> {
  const kept: SessionChoice = { theme: id ?? null }
  const stood = await $.store.get(key)

  await $.store.delete(key)

  try {
    await $.store.set(key, kept)
  } catch (error) {
    if (stood !== undefined) {
      try {
        await $.store.set(key, stood)
      } catch {
        // The first fault is the one to tell.
      }
    }

    throw error
  }

  try {
    const keys = (await $.store.keys()).filter(name => name.startsWith(SESSION_PREFIX))

    for (const oldest of keys.slice(0, Math.max(0, keys.length - SESSIONS_KEPT))) {
      await $.store.delete(oldest)
    }
  } catch {
    // The next choice tries again.
  }
}

/**
 * The one way this mod changes the backdrop: nothing else calls `show`.
 *
 * Sets first, keeps second. If keeping fails the window is put back to what stood and the first fault is thrown on, so what a person sees and what they are told agree.
 */
async function showThenKeep(
  $: EngineInterface,
  id: string | undefined,
  keep?: () => Promise<unknown>,
): Promise<BackdropAnswer | undefined> {
  const stood = await read($, choice)
  const set = await show($, id)

  try {
    await keep?.()
  } catch (error) {
    try {
      await show($, stood.preview ?? stood.applied)
    } catch {
      // The first fault is the one to tell.
    }

    throw error
  }

  return set
}

/** Applies a theme (or none) to this session, and with `forProject` to every later session of the project. A choice for this session alone is stored under the session's key; one for the project takes that key away. */
async function apply(
  $: EngineInterface,
  id: string | undefined,
  forProject: boolean,
): Promise<BackdropAnswer | undefined> {
  return showThenKeep($, id, async () => {
    const own = await sessionKey($)

    // The session's key first: where that fails, nothing is written for the project, and "could not be applied" is true.
    if (own !== undefined) {
      await (forProject ? $.store.delete(own) : keepForSession($, own, id))
    }

    if (forProject) {
      const keys = await projectKeys($)

      if (id === undefined) {
        for (const key of keys.clear) {
          await $.store.delete(key)
        }
      } else {
        await $.store.set(keys.write, id)
      }
    }

    await update($, choice, (was): ThemeChoice => ({
      cardInBand: was.cardInBand,
      cardAway: was.cardAway,
      applied: id,
      scope: forProject ? 'project' : 'session',
    }))
  })
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Runs a step that must never cost a person their start or their prompt. Its fault goes to one dim transcript line, which the model does not see. No toast: one at every turn would nag. */
async function quietly($: EngineInterface, step: () => Promise<void>): Promise<void> {
  try {
    await step()
  } catch (error) {
    try {
      await $.ui.log(`a step nobody waits on failed, and the window stays as it is (${reasonOf(error)})`)
    } catch {
      // An engine without that call, or one that refuses it: nothing more to tell.
    }
  }
}

/** Said when a theme is set that no surface draws. Only a project's choice is called saved, because it is always stored; a session's own needs an id, and with none it is not stored at all. */
function unshownNote(isSaved: boolean): string {
  return isSaved ? KEPT_UNSHOWN : `${UNSHOWN}.`
}

/** What became of a pick: a fault's one plain sentence; or none, and whether a theme was set that no surface draws. */
type Picked = { fault: string } | { fault: undefined; isUnshown: boolean }

/** Applies what a person picked, or says in one plain sentence why it could not, in the fault's own words. Nothing is kept then and the theme that stood stays. */
async function applyOrSay(
  $: EngineInterface,
  theme: Theme | undefined,
  forProject: boolean,
): Promise<Picked> {
  const fault = theme === undefined ? undefined : sceneFault(theme)

  if (theme !== undefined && fault !== undefined) {
    return { fault: `${theme.title} could not be drawn: ${fault}` }
  }

  try {
    const set = await apply($, theme?.id, forProject)

    return { fault: undefined, isUnshown: set?.isDrawn === false }
  } catch (error) {
    return {
      fault:
        theme === undefined
          ? `The theme could not be cleared: ${reasonOf(error)}`
          : `${theme.title} could not be applied: ${reasonOf(error)}`,
    }
  }
}

/** The project's stored choice: a theme's id, or none. The first key that holds one wins. */
async function projectChoice($: EngineInterface): Promise<string | undefined> {
  for (const key of (await projectKeys($)).read) {
    const stored = await $.store.get(key)

    if (typeof stored === 'string' && themeOf(stored) !== undefined) {
      return stored
    }
  }

  return undefined
}

/**
 * Brings a session to the choice it is due, at a start and at every turn's start, so a session open while another changed the project picks the change up next turn.
 *
 * A session with its own choice in this process is left alone; one whose own choice an earlier process stored takes it up again; any other follows its project.
 */
async function followChoice($: EngineInterface): Promise<void> {
  const now = await read($, choice)
  const project = await projectChoice($)
  const isOwn = now.scope === 'session' || (now.scope === undefined && now.applied !== undefined && now.applied !== project)

  if (now.preview !== undefined || showEnding !== undefined) {
    return
  }

  const key = await sessionKey($)
  const kept = key === undefined ? undefined : await sessionChoice($, key)

  if (isOwn) {
    if (key !== undefined && kept === undefined) {
      await keepForSession($, key, now.applied)
    }

    return
  }

  if (kept !== undefined) {
    const own = kept.theme ?? undefined
    const take = (): Promise<unknown> =>
      update($, choice, (was): ThemeChoice => ({ ...was, applied: own, scope: 'session' }))

    // None chosen and none shown: the engine is asked nothing, or a clear would take another mod's theme away.
    await (own === undefined && now.applied === undefined ? take() : showThenKeep($, own, take))

    return
  }

  if (now.applied === project) {
    return
  }

  // Asked first: a theme the engine refuses is not taken as applied, and the next turn tries it again.
  await showThenKeep($, project, () =>
    update($, choice, (was): ThemeChoice => ({ ...was, applied: project, scope: 'project' })),
  )
}

/** Ends a preview unless the theme was applied meanwhile. It runs from a timer with nobody to tell, so it runs `quietly`; after an unload the engine refuses both it and its note, which leaves nothing to do. */
async function endPreview($: EngineInterface, id: string): Promise<void> {
  previewEnding = undefined

  const later = await read($, choice)

  if (later.preview === id) {
    await showThenKeep($, later.applied, () => update($, choice, was => ({ ...was, preview: undefined })))
  }
}

/** Ends a show, back to the session's theme or to no backdrop. The flag is released only once the window is back: an ask arriving while the end waits on the engine would otherwise start a show this end draws over. */
async function endFireworks($: EngineInterface): Promise<void> {
  try {
    const later = await read($, choice)

    await showThenKeep($, later.preview ?? later.applied)
  } finally {
    showEnding = undefined
  }
}

/**
 * Seven seconds of fireworks, over the session's theme or over a night sky of their own.
 *
 * One show at a time: the flag is taken in the same tick it is tested, ahead of the first await, or a second ask would pass the test while the first waits.
 */
async function fireworks($: EngineInterface): Promise<string> {
  if (showEnding !== undefined) {
    return 'Fireworks are already going.'
  }

  showEnding = 'starting'
  showCount += 1

  // The theme stays: a show is a sibling backdrop that draws the theme's scene with the bursts over it.
  const suffix = SHOW_SUFFIXES[showCount % SHOW_SUFFIXES.length] ?? SHOW_SUFFIXES[0]
  let set: BackdropAnswer

  try {
    const now = await read($, choice)
    const theme = themeOf(now.preview ?? now.applied)

    set = await setBackdrop(
      $,
      theme === undefined
        ? { id: NIGHT_ID, glass: NIGHT_GLASS }
        : { id: `${theme.id}${suffix}`, glass: theme.glass, colorScheme: theme.window, colors: theme.colors },
    )
  } catch (error) {
    // A show that did not begin costs a reply nothing, and the next word may try again.
    showEnding = undefined

    return `Fireworks could not be shown: ${reasonOf(error)}`
  }

  showEnding = $.clock.after(SHOW_MS, () => void quietly($, () => endFireworks($)))

  return set?.isDrawn === false ? `Fireworks. ${SHOW_UNSHOWN}` : 'Fireworks.'
}

/** Whether a show may go off by itself on the word. Off unless the person asked, the opposite of the forked plugin, and a store that cannot be read counts as off too: on a doubt, no picture comes unasked. */
async function goesOffByItself($: EngineInterface): Promise<boolean> {
  try {
    return (await $.store.get(AUTO_KEY)) === 'on'
  } catch {
    return false
  }
}

/** The `fireworks` words of the command: alone it starts a show, `auto on` and `auto off` write the key. */
async function fireworksWords($: EngineInterface, rest: string): Promise<string> {
  if (rest === '') {
    return fireworks($)
  }

  if (rest !== 'auto off' && rest !== 'auto on') {
    return `Try /${COMMAND} fireworks, /${COMMAND} fireworks auto on or /${COMMAND} fireworks auto off.`
  }

  try {
    await (rest === 'auto on' ? $.store.set(AUTO_KEY, 'on') : $.store.delete(AUTO_KEY))
  } catch (error) {
    return `That could not be kept: ${reasonOf(error)}`
  }

  return rest === 'auto on'
    ? 'Fireworks will go off when Claude says "merged".'
    : `Fireworks no longer go off by themselves. /${COMMAND} fireworks still starts a show.`
}

type CardElements = Pick<
  ReturnType<EngineInterface['ui']['resolve']>,
  'Box' | 'Text' | 'Button'
>

/** Puts the card away, placed or above the prompt, until the command shows it again. */
async function putCardAway($: EngineInterface): Promise<void> {
  await update($, choice, was => ({ ...was, cardInBand: false, cardAway: true }))
}

/** A pick on the card applies the theme and puts the card away, as a menu closes on a choice. A pick that could not be kept is said and the card stays open for another. */
async function pick($: EngineInterface, theme: Theme | undefined, forProject: boolean): Promise<void> {
  const picked = await applyOrSay($, theme, forProject)

  if (picked.fault !== undefined) {
    void $.ui.toast(picked.fault)

    return
  }

  if (picked.isUnshown) {
    void $.ui.toast(unshownNote(forProject))
  }

  await putCardAway($)
}

/**
 * The card. Close and No theme sit at the head so it can be dismissed without scrolling past every theme, and themes are grouped by window kind because a mod cannot learn which kind the window is.
 *
 * Every button sets both `label` and children: the desktop draws `label` and never the children, other surfaces draw the children.
 */
function card($: EngineInterface, { Box, Text, Button }: CardElements, now: ThemeChoice) {
  // Spacing comes from each parent's gap: wider between themes than inside one, so a row of buttons reads as belonging to its own theme.
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} gap="md">
      <Box flexDirection="row" gap={1}>
        <Text bold>w0n-themes</Text>
        <Button key="off" label="No theme" onPress={() => pick($, undefined, true)}>
          No theme
        </Button>
        {/* Keyboard focus starts here where a surface carries it: Enter on Close changes nothing but the card. */}
        <Button
          key="close"
          label="Close"
          role="dismiss"
          autoFocus
          onPress={() => putCardAway($)}
        >
          Close
        </Button>
      </Box>
      {WINDOWS.map(window => (
        <Box key={`group-${window}`} flexDirection="column" gap="md">
          <Text key={`head-${window}`} size="heading" bold>{`For ${window} windows`}</Text>
          {THEMES.filter(theme => theme.window === window).map(theme => {
            const twin = themeOf(theme.twin)
            const applyWord = now.applied === theme.id && now.scope !== 'session' ? 'Applied' : 'Apply'
            const sessionWord = now.applied === theme.id && now.scope === 'session' ? '✓ This session' : 'This session'
            const previewWord = now.preview === theme.id ? 'Previewing' : 'Preview'

            return (
              <Box key={`theme-${theme.id}`} flexDirection="column" gap="xs">
                <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" columnGap="md" rowGap="xs">
                  <Text bold={now.applied === theme.id}>
                    {now.applied === theme.id ? '✓ ' : ''}
                    {theme.title}
                  </Text>
                  <Box flexDirection="row" gap={1}>
                    <Button key={`apply-${theme.id}`} label={applyWord} onPress={() => pick($, theme, true)}>
                      {applyWord}
                    </Button>
                    <Button
                      key={`session-${theme.id}`}
                      label={sessionWord}
                      onPress={() => pick($, theme, false)}
                    >
                      {sessionWord}
                    </Button>
                    <Button
                      key={`preview-${theme.id}`}
                      label={previewWord}
                      onPress={async () => {
                        let set: BackdropAnswer | undefined

                        try {
                          set = await showThenKeep($, theme.id, () => update($, choice, was => ({ ...was, preview: theme.id })))
                        } catch (error) {
                          // A preview that never began leaves an earlier one its own end.
                          void $.ui.toast(`${theme.title} could not be shown: ${reasonOf(error)}`)

                          return
                        }

                        // Cancel the earlier timer, or it would end this preview early.
                        previewEnding?.cancel()
                        previewEnding = $.clock.after(PREVIEW_MS, () => void quietly($, () => endPreview($, theme.id)))

                        // After the timer, so nothing stands between the state write and its clock.
                        if (set?.isDrawn === false) {
                          void $.ui.toast(unshownNote(false))
                        }
                      }}
                    >
                      {previewWord}
                    </Button>
                  </Box>
                </Box>
                <Text dimColor>{theme.blurb}</Text>
                {twin === undefined ? [] : [<Text key={`twin-${theme.id}`} dimColor>{`For ${twin.window} windows: ${twin.title}`}</Text>]}
              </Box>
            )
          })}
        </Box>
      ))}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // A refused name must not cost the session its backdrop: go on without the command.
    try {
      await $.command.register({
        name: COMMAND,
        description:
          'A backdrop behind the chat: alone it shows the card; with a theme\'s name it applies that theme to this project (add "session" for this session only); "list" names them, "off" clears, "fireworks" sets off a few seconds of them.',
      })
    } catch (error) {
      void $.ui.toast(`w0n-themes: /${COMMAND} is not available (${String(error)})`)
    }

    // A preview left in the state has no timer in this load, so its end never ran. Drop it, or the session would never follow its project again.
    if ((await read($, choice)).preview !== undefined) {
      await update($, choice, was => ({ ...was, preview: undefined }))
    }

    // Two quiet steps on purpose: a choice that cannot be followed must not cost the window what the state already holds.
    await quietly($, () => followChoice($))
    await quietly($, async () => {
      const shown = (await read($, choice)).applied

      if (themeOf(shown) !== undefined) {
        await showThenKeep($, shown)
      }
    })

    return next(e)
  })

  // At a turn's start an open session picks up a change another session made to the project. It always passes on: a fault here must never cost the person their prompt.
  on('prompt.submit', async ($, e, next) => {
    await quietly($, () => followChoice($))

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const words = e.args.trim().split(/\s+/).filter(word => word !== '')
    const last = words.at(-1)?.toLowerCase()
    // A scope word is the last of two or more words, and only these two; anything else is part of the name.
    const isScoped = words.length > 1 && (last === 'session' || last === 'project')
    const forProject = !(isScoped && last === 'session')
    const name = (isScoped ? words.slice(0, -1) : words).join(' ')
    const key = keyOf(name)

    if (name === '') {
      // A surface that draws no placed rows yet gets the card above the prompt instead.
      const placed = await $.ui.place({ id: CARD })

      await update($, choice, was => ({ ...was, cardInBand: !placed.isPlaced, cardAway: false }))

      return { text: 'Pick a theme on the card.' }
    }

    if (key === 'list') {
      return { text: themeList() }
    }

    if (words[0]?.toLowerCase() === 'fireworks') {
      return { text: await fireworksWords($, words.slice(1).join(' ').toLowerCase()) }
    }

    if (key === 'off') {
      const cleared = await applyOrSay($, undefined, forProject)

      if (cleared.fault !== undefined) {
        return { text: cleared.fault }
      }

      return {
        text: forProject
          ? 'Theme cleared for this project. Other open sessions of it clear at their next turn.'
          : 'Theme cleared for this session only. The project keeps its theme for other sessions.',
      }
    }

    const theme = themeNamed(name)

    if (theme === undefined) {
      // One line, so the reason stays in view. Nothing is applied and nothing is stored.
      const nearest = nearestTheme(name)

      return {
        text:
          `No theme named "${name}". ` +
          (nearest === undefined ? '' : `The nearest is ${nearest.id}. `) +
          `/${COMMAND} list names all ${THEMES.length}; "session" as the last word is this session only.`,
      }
    }

    const picked = await applyOrSay($, theme, forProject)

    if (picked.fault !== undefined) {
      return { text: picked.fault }
    }

    // A mod cannot learn which kind the window is, so every answer names the kind and the theme's twin.
    const twin = themeOf(theme.twin)
    const said =
      (forProject
        ? `${theme.title} applied to this project. Other open sessions of it take it at their next turn.`
        : `${theme.title} applied to this session only.`) +
      ` Made for ${theme.window} windows${twin === undefined ? '' : ` (for ${twin.window} windows: ${twin.id})`}.`

    return { text: picked.isUnshown ? `${said} ${unshownNote(forProject)}` : said }
  })

  // Every block of the model's reply passes through here once, as text, before it is stored.
  on('session.append', { door: 'response' }, async ($, e, next) => {
    const said = e.message.content.some(
      block => block.type === 'text' && typeof block.text === 'string' && WORD.test(block.text),
    )

    if (said && (await goesOffByItself($))) {
      await fireworks($)
    }

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    // Only a window has room behind the chat, and only its table has `Svg`. Mobile is in: the forked plugin takes desktop alone, which quietly leaves the phone with no backdrop at all.
    if (e.props.plugin !== PLUGIN || (e.surface !== 'desktop' && e.surface !== 'mobile')) {
      return next(e)
    }

    const name = sceneNameOf(e.props)

    if (name === undefined) {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)

    if (name === NIGHT_ID) {
      return <Svg isInteractive alt="Fireworks bursting over a night sky" source={nightScene()} />
    }

    const showOf = themeOf(themeIdOfShow(name))

    if (showOf !== undefined) {
      return (
        <Svg
          isInteractive
          alt={`Fireworks over ${showOf.title}`}
          source={sceneWithFireworks(showOf, sceneOf(showOf))}
        />
      )
    }

    const theme = themeOf(name)

    if (theme === undefined) {
      return next(e)
    }

    return <Svg isInteractive alt={`${theme.title}: ${theme.blurb}`} source={sceneOf(theme)} />
  })

  on('ui.render', { component: 'Placed' }, async ($, e, next) => {
    if (e.props.plugin !== PLUGIN || e.props.id !== CARD) {
      return next(e)
    }

    const now = await read($, choice)

    // Put away. A placed row whose hook passes draws nothing.
    if (now.cardAway === true) {
      return next(e)
    }

    return card($, $.ui.resolve(e), now)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await read($, choice)

    if (now.cardInBand !== true) {
      return next(e)
    }

    return card($, $.ui.resolve(e), now)
  })
}
