import type { EditorFontMode } from '../settings/settings'

export const EDITOR_FONT_MIN = 10
export const EDITOR_FONT_MAX = 40
export const EDITOR_FONT_DEFAULT = 14

export interface MonacoFontOptions {
  fontSize: number
  lineHeight: number
  fontFamily: string
  fontLigatures: boolean
  letterSpacing: number
  fontWeight: string
  disableMonospaceOptimizations: boolean
}

export function clampEditorFontSize(value: number) {
  if (!Number.isFinite(value)) return EDITOR_FONT_DEFAULT
  return Math.min(EDITOR_FONT_MAX, Math.max(EDITOR_FONT_MIN, Math.round(value)))
}

export function getEditorFontFamily(mode: EditorFontMode) {
  // Keep Code::Blocks mode on a single, native Windows monospace font.
  // Mixing fallback fonts can make Monaco measure a different advance width than
  // WebView2 actually paints, which shows up as mouse/caret/selection drift.
  return mode === 'jetbrains'
    ? '"JetBrains Mono", Consolas, "Courier New", monospace'
    : '"Consolas"'
}

export function getEditorLineHeight(fontSize: number) {
  const size = clampEditorFontSize(fontSize)
  // A tighter Code::Blocks-like rhythm. The previous ~1.46 ratio became visibly
  // too tall at large zoom levels. Cap the extra leading so 24-40px text still
  // feels like code instead of a document editor.
  const extra = Math.round(Math.min(8, Math.max(4, size * 0.25)))
  return size + extra
}

export function makeMonacoFontOptions(fontSize: number, mode: EditorFontMode, fontLigatures: boolean): MonacoFontOptions {
  const size = clampEditorFontSize(fontSize)
  return {
    fontSize: size,
    lineHeight: getEditorLineHeight(size),
    fontFamily: getEditorFontFamily(mode),
    // Code::Blocks mode is deliberately literal: !=, <= and -> remain separate
    // characters. JetBrains mode may opt into ligatures from Settings.
    fontLigatures: mode === 'codeblocks' ? false : fontLigatures,
    letterSpacing: 0,
    fontWeight: 'normal',
    // Correctness over the tiny monospace fast-path: this avoids caret drift on
    // Windows when fallback glyphs have slightly different metrics.
    disableMonospaceOptimizations: true,
  }
}
