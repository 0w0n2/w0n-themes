export type ThemeChoice = {
  /** The theme this session shows, by its own choice or its project's. Absent means none. */
  applied?: string
  /** Whose choice `applied` is. A session's own survives every later start; any other follows the project. Absent in a choice stored before this field existed. */
  scope?: 'session' | 'project'
  /** A theme shown for a preview only, until it is applied or the preview ends. */
  preview?: string
  /** Show the card above the prompt, because this surface draws no placed rows yet. */
  cardInBand?: boolean
  /** The placed card was dismissed: its hook passes until the command shows it again. */
  cardAway?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    // Must match the atom owner in hooks/register.tsx, which must match plugin.json's name.
    'w0n-themes': { choice: Shaped<ThemeChoice> }
  }
}
