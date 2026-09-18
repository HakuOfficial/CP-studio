import type { CompareMode } from '../tauri-bridge'
import type { GlassEffect } from '../window/windowControls'

export type EditorFontMode = 'codeblocks' | 'jetbrains'
export type GlassMaterial = Exclude<GlassEffect, 'off'>
export type GlassOpacityByEffect = Record<GlassMaterial, number>

export interface AppSettings {
  fontSize: number
  editorFont: EditorFontMode
  tabSize: number
  minimap: boolean
  autoSave: boolean
  fontLigatures: boolean
  compilerPath: string
  cppStandard: string
  optimization: string
  extraFlags: string
  timeLimitMs: number
  memoryLimitMb: number
  compareMode: CompareMode
  glassEffect: GlassEffect
  /** Dark UI tint for each native material. Lower = more transparent. */
  glassOpacityByEffect: GlassOpacityByEffect
  /** Extra dark surface behind Monaco only, useful when wallpaper is busy. */
  editorShadeOpacity: number
  keybindings: Record<string, string>
}

export const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 14,
  // Consolas is stable inside WebView2 and matches the classic Code::Blocks feel.
  editorFont: 'codeblocks',
  tabSize: 4,
  minimap: true,
  autoSave: true,
  // Keep operators literal by default: != stays !=, <= stays <=, -> stays ->.
  fontLigatures: false,
  compilerPath: '',
  cppStandard: 'gnu++20',
  optimization: '-O2',
  extraFlags: '-Wall -Wextra',
  timeLimitMs: 1000,
  memoryLimitMb: 256,
  compareMode: 'trim',
  glassEffect: 'vibrancy',
  glassOpacityByEffect: {
    vibrancy: 0.24,
    acrylic: 0.28,
    mica: 0.40,
    blur: 0.22,
  },
  editorShadeOpacity: 0.14,
  keybindings: {
    expandSnippet: 'Ctrl+J',
    runCurrent: 'Ctrl+Enter',
    runAll: 'Ctrl+Shift+Enter',
    compile: 'F6',
    generate: 'Ctrl+G',
    stress: 'Ctrl+Shift+G',
    newTest: 'Ctrl+T',
  },
}

const KEY = 'codefightide.settings.v1'
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function loadSettings(): AppSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}')

    // v0.4.1 migration. v0.4.0 stored one glassOpacity value for every effect.
    // Preserve the user's chosen visual strength by seeding all materials from it.
    const legacyOpacity = typeof stored.glassOpacity === 'number'
      ? (stored.glassOpacity > 0.62 ? 0.24 : clamp(stored.glassOpacity, 0.05, 0.90))
      : undefined

    const storedByEffect = stored.glassOpacityByEffect && typeof stored.glassOpacityByEffect === 'object'
      ? stored.glassOpacityByEffect
      : {}

    const glassOpacityByEffect: GlassOpacityByEffect = {
      vibrancy: clamp(Number(storedByEffect.vibrancy ?? legacyOpacity ?? DEFAULT_SETTINGS.glassOpacityByEffect.vibrancy), 0.05, 0.90),
      acrylic: clamp(Number(storedByEffect.acrylic ?? legacyOpacity ?? DEFAULT_SETTINGS.glassOpacityByEffect.acrylic), 0.05, 0.90),
      mica: clamp(Number(storedByEffect.mica ?? legacyOpacity ?? DEFAULT_SETTINGS.glassOpacityByEffect.mica), 0.05, 0.90),
      blur: clamp(Number(storedByEffect.blur ?? legacyOpacity ?? DEFAULT_SETTINGS.glassOpacityByEffect.blur), 0.05, 0.90),
    }

    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      fontSize: clamp(Number(stored.fontSize ?? DEFAULT_SETTINGS.fontSize), 10, 40),
      editorFont: stored.editorFont === 'jetbrains' ? 'jetbrains' : 'codeblocks',
      glassOpacityByEffect,
      editorShadeOpacity: clamp(Number(stored.editorShadeOpacity ?? DEFAULT_SETTINGS.editorShadeOpacity), 0, 0.85),
      keybindings: {
        ...DEFAULT_SETTINGS.keybindings,
        ...(stored.keybindings || {}),
      },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function splitFlags(s: string) {
  return s.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(x => x.replace(/^"|"$/g, '')) ?? []
}

export function eventShortcut(e: KeyboardEvent) {
  const p: string[] = []
  if (e.ctrlKey) p.push('Ctrl')
  if (e.shiftKey) p.push('Shift')
  if (e.altKey) p.push('Alt')
  if (e.metaKey) p.push('Meta')
  let k = e.key
  if (k === ' ') k = 'Space'
  if (k.length === 1) k = k.toUpperCase()
  p.push(k)
  return p.join('+')
}
