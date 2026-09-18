import { isTauri } from '@tauri-apps/api/core'
import { Effect, getCurrentWindow } from '@tauri-apps/api/window'
import { getCurrentWebview } from '@tauri-apps/api/webview'

export type GlassEffect = 'off' | 'vibrancy' | 'acrylic' | 'mica' | 'blur'
export type ResizeDirection = 'East' | 'North' | 'NorthEast' | 'NorthWest' | 'South' | 'SouthEast' | 'SouthWest' | 'West'

function currentWindow() {
  if (!isTauri()) return null
  return getCurrentWindow()
}


export async function resetWebviewZoom() {
  if (!isTauri()) return
  // Browser/WebView zoom changes pointer coordinates as well as glyph metrics.
  // CP Studio performs code zoom by changing Monaco fontSize instead, so keep
  // the whole WebView at a strict 100% to prevent mouse/caret drift.
  await getCurrentWebview().setZoom(1)
}

export async function minimizeWindow() {
  const w = currentWindow(); if (!w) return
  await w.minimize()
}

export async function toggleMaximizeWindow() {
  const w = currentWindow(); if (!w) return
  await w.toggleMaximize()
}

export async function closeWindow() {
  const w = currentWindow(); if (!w) return
  await w.close()
}

export async function startWindowDragging() {
  const w = currentWindow(); if (!w) return
  await w.startDragging()
}

export async function startWindowResize(direction: ResizeDirection) {
  const w = currentWindow(); if (!w) return
  await w.startResizeDragging(direction)
}

/**
 * Apply exactly one native material at a time.
 *
 * Tauri exposes clearEffects() for switching effects. The old implementation
 * attempted to disable glass with setEffects({ effects: [] }), which can leave
 * stale DWM material state on Windows after a few switches/build launches.
 */
export async function applyGlassEffect(effect: GlassEffect) {
  const w = currentWindow(); if (!w) return

  await w.clearEffects()
  if (effect === 'off') return

  // Modern Windows 11 does not reliably support the legacy DWM Blur effect.
  // 'vibrancy' intentionally uses Acrylic: it is the closest stable Windows
  // material to VS Code Vibrancy Continued's frosted-glass appearance.
  const nativeEffect: Effect = effect === 'vibrancy' || effect === 'acrylic'
    ? Effect.Acrylic
    : effect === 'mica'
      ? Effect.Mica
      : Effect.Blur

  await w.setEffects({ effects: [nativeEffect] })
}
