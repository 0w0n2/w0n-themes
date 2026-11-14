// The key a project-wide theme is stored under, built so a session in a linked git worktree meets its project's choice. Erasable TypeScript only, no imports: this runs under node's own type stripping.

/** What the engine's stat answers. A missing or withheld path is a rejection, not an answer. */
export interface StatAnswer {
  kind: 'file' | 'directory' | 'other'
  /** Absolute, every link followed. Absent where the engine gives none. */
  realPath?: string
}

/** The four engine calls the key is built from. register.tsx binds them to the engine's own names. */
export interface KeyEngine {
  root(): Promise<string>
  cwd(): Promise<string>
  /** The session's root inside the repository, null outside one. May reject on an older engine. */
  repo(): Promise<string | null>
  stat(path: string): Promise<StatAnswer>
}

export type KeyStep =
  | 'k1-cwd-apart'
  | 'k2-no-repository'
  | 'k3-no-real-path'
  | 'k4-no-entry'
  | 'k5-main-tree'
  | 'k6-own-root'
  | 'k6-other-marker'
  | 'k6-cwd-spelling'
  | 'k6-linked-worktree'
  | 'k7-other-kind'

export interface KeyAnswer {
  /** Read first, and the only key ever written. */
  key: string
  /** The legacy key, read after `key` and cleared with it. Null where it must not be read. */
  olderKey: string | null
  /** False means valid for this ask alone, and rebuilt at the next turn. */
  keep: boolean
  /** Which of the seven steps produced the key. For tests and the debug line. */
  step: KeyStep
}

/** Cached in the process beside the root it was built for. */
export interface KeptKey {
  forRoot: string
  answer: KeyAnswer
}

/** A fixed cap alongside the separator count, guarding a walk that should never be long. */
export const WALK_CAP = 64

const ENTRY_NAME = '.git'

function lastSeparatorIndex(path: string): number {
  return Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
}

function separatorOf(path: string): string {
  return path.includes('/') ? '/' : '\\'
}

function countSeparators(path: string): number {
  let count = 0
  for (const sign of path) {
    if (sign === '/' || sign === '\\') count += 1
  }
  return count
}

function isBelow(path: string, folder: string): boolean {
  return path.startsWith(folder + '/') || path.startsWith(folder + '\\')
}

function isAtOrBelow(path: string, folder: string): boolean {
  return path === folder || isBelow(path, folder)
}

async function statOrNull(
  engine: KeyEngine,
  path: string,
): Promise<StatAnswer | null> {
  try {
    return await engine.stat(path)
  } catch {
    return null
  }
}

async function realPathOrNull(
  engine: KeyEngine,
  path: string,
): Promise<string | null> {
  const answer = await statOrNull(engine, path)
  return answer?.realPath ?? null
}

async function repoOrNull(engine: KeyEngine): Promise<string | null> {
  try {
    return await engine.repo()
  } catch {
    return null
  }
}

function keyOfToday(
  prefix: string,
  rootAsAnswered: string,
  keep: boolean,
  step: KeyStep,
): KeyAnswer {
  return { key: prefix + rootAsAnswered, olderKey: null, keep, step }
}

/** k5 and the first two ends of k6: the root's real path, with the legacy key behind it where they differ. */
function keyOfRealRoot(
  prefix: string,
  rootAsAnswered: string,
  realRoot: string,
  step: KeyStep,
): KeyAnswer {
  const key = prefix + realRoot
  const today = prefix + rootAsAnswered
  return { key, olderKey: today === key ? null : today, keep: true, step }
}

interface WalkFind {
  top: string
  kind: StatAnswer['kind']
}

/** k4: from the real root upward, one stat per step. A rejected step counts as no entry. */
async function findWorkingTreeTop(
  engine: KeyEngine,
  realRoot: string,
): Promise<WalkFind | null> {
  const steps = Math.min(countSeparators(realRoot), WALK_CAP)
  let folder = realRoot
  for (let step = 0; step < steps; step += 1) {
    const entry = await statOrNull(
      engine,
      folder + separatorOf(realRoot) + ENTRY_NAME,
    )
    if (entry !== null) return { top: folder, kind: entry.kind }
    const cut = lastSeparatorIndex(folder)
    if (cut <= 0) return null
    folder = folder.slice(0, cut)
  }
  return null
}

/** The seven steps. Every failing step falls back to the legacy key, and the first two calls may reject, which is the caller's to catch. Reads only. */
export async function makeProjectKey(
  engine: KeyEngine,
  prefix: string,
): Promise<KeyAnswer> {
  const rootAsAnswered = await engine.root()
  const cwdAsAnswered = await engine.cwd()

  const realRoot = await realPathOrNull(engine, rootAsAnswered)
  if (realRoot === null)
    return keyOfToday(prefix, rootAsAnswered, true, 'k3-no-real-path')
  const realCwd = await realPathOrNull(engine, cwdAsAnswered)
  if (realCwd !== realRoot)
    return keyOfToday(prefix, rootAsAnswered, false, 'k1-cwd-apart')

  const repoAsAnswered = await repoOrNull(engine)
  if (repoAsAnswered === null)
    return keyOfToday(prefix, rootAsAnswered, true, 'k2-no-repository')

  const realRepo = await realPathOrNull(engine, repoAsAnswered)
  if (realRepo === null)
    return keyOfToday(prefix, rootAsAnswered, true, 'k3-no-real-path')

  const find = await findWorkingTreeTop(engine, realRoot)
  if (find === null)
    return keyOfToday(prefix, rootAsAnswered, true, 'k4-no-entry')

  if (find.kind === 'directory')
    return keyOfRealRoot(prefix, rootAsAnswered, realRoot, 'k5-main-tree')
  if (find.kind !== 'file')
    return keyOfToday(prefix, rootAsAnswered, true, 'k7-other-kind')

  if (realRepo === find.top)
    return keyOfRealRoot(prefix, rootAsAnswered, realRoot, 'k6-own-root')
  if (isBelow(realRepo, find.top) && isAtOrBelow(realRoot, realRepo)) {
    return keyOfRealRoot(prefix, rootAsAnswered, realRoot, 'k6-other-marker')
  }
  // The engine climbed from a spelling that is not the real one. Normalised for this one compare only.
  if (cwdAsAnswered.normalize('NFC') !== realCwd.normalize('NFC')) {
    return keyOfToday(prefix, rootAsAnswered, true, 'k6-cwd-spelling')
  }
  const restBelowTop = realRoot.slice(find.top.length)
  return {
    key: prefix + realRepo + restBelowTop,
    olderKey: null,
    keep: true,
    step: 'k6-linked-worktree',
  }
}

export interface KeyLookup {
  answer: KeyAnswer
  kept: KeptKey | null
}

/** Built once and cached against the root, rebuilt only when the root moves. */
export async function projectKeyFor(
  engine: KeyEngine,
  prefix: string,
  kept: KeptKey | null,
): Promise<KeyLookup> {
  const rootAsAnswered = await engine.root()
  if (kept !== null && kept.forRoot === rootAsAnswered)
    return { answer: kept.answer, kept }
  const answer = await makeProjectKey(engine, prefix)
  return {
    answer,
    kept: answer.keep ? { forRoot: rootAsAnswered, answer } : null,
  }
}

/** Read order: the first key holding a choice wins. */
export function keysToRead(answer: KeyAnswer): string[] {
  return answer.olderKey === null ? [answer.key] : [answer.key, answer.olderKey]
}

/** A write goes to the new key alone. */
export function keyToWrite(answer: KeyAnswer): string {
  return answer.key
}

/** A project-wide clear takes both keys, or the older choice comes back at the next read. */
export function keysToClear(answer: KeyAnswer): string[] {
  return keysToRead(answer)
}
