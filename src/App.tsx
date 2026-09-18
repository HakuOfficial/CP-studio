import { useState, useCallback, useRef, useEffect } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { AlertTriangle, BarChart3, Check, Circle, Clock3, Dices, FilePlus2, FlaskConical, FolderOpen, Hammer, LoaderCircle, MemoryStick, Play, Save, Settings, Square, Swords, Trash2, Plus, Minus, Maximize2, X, type LucideIcon } from 'lucide-react'
import type { UITestCase, UIVerdict, PanelTab, Language, CompileResult } from './types'
import {
  compileCode, runTestcase, runAllTestcases,
  compileGenerator, compileBrute, generateInput, runStressTest,
  saveFileDialog, openFileDialog, getTempDir, detectCompilers, stopProcesses, pingBackend, selectCompilerDialog,
} from './tauri-bridge'
import type { StressIteration, CompareMode, CompilerInfo, CompilerDiagnostic } from './tauri-bridge'
import { loadSettings, saveSettings, splitFlags, eventShortcut, type AppSettings } from './settings/settings'
import { loadSnippets, saveSnippets, findSnippet, renderSnippetFallback, type CodeSnippet } from './snippets/snippets'
import TestsPanel from './components/TestsPanel'
import OutputPanel from './components/OutputPanel'
import GeneratorPanel, { DEFAULT_GENERATOR_CODE } from './components/GeneratorPanel'
import StressPanel, { DEFAULT_BRUTE_CODE } from './components/StressPanel'
import { applyGlassEffect, closeWindow, minimizeWindow, resetWebviewZoom, startWindowResize, toggleMaximizeWindow, type ResizeDirection } from './window/windowControls'
import { CPStudioBrand, EditorLoadingScreen } from './components/Branding'
import { CP_STUDIO_GLASS_THEME, installCpStudioMonacoTheme } from './editor/monacoTheme'
import { EDITOR_FONT_DEFAULT, EDITOR_FONT_MAX, EDITOR_FONT_MIN, clampEditorFontSize, makeMonacoFontOptions } from './editor/editorAppearance'

// ── Starter templates ────────────────────────────────────────────────────────
const STARTER: Record<Language, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int n;
    cin >> n;
    vector<int> a(n);
    for (int& x : a) cin >> x;

    long long ans = 0;
    for (int x : a) ans += x;
    cout << ans << "\\n";

    return 0;
}`,
  python: `import sys
input = sys.stdin.readline

def solve():
    n = int(input())
    a = list(map(int, input().split()))
    print(sum(a))

solve()`,
  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        int n = Integer.parseInt(br.readLine().trim());
        StringTokenizer st = new StringTokenizer(br.readLine());
        long ans = 0;
        for (int i = 0; i < n; i++)
            ans += Long.parseLong(st.nextToken());
        System.out.println(ans);
    }
}`,
}

const LANG_EXT: Record<Language, string> = { cpp: 'cpp', python: 'py', java: 'java' }
const LANG_MONACO: Record<Language, string> = { cpp: 'cpp', python: 'python', java: 'java' }

function genId() { return Math.random().toString(36).slice(2, 10) }

// ── Monaco options ────────────────────────────────────────────────────────────
const EDITOR_OPTS = {
  fontLigatures: false,
  letterSpacing: 0,
  fontWeight: '400',
  disableMonospaceOptimizations: true,
  minimap: { enabled: true, scale: 1, renderCharacters: false },
  scrollBeyondLastLine: false,
  wordWrap: 'off' as const,
  tabSize: 4,
  insertSpaces: true,
  renderWhitespace: 'none' as const,
  padding: { top: 14, bottom: 14 },
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  renderLineHighlight: 'gutter' as const,
  cursorBlinking: 'smooth' as const,
  smoothScrolling: true,
  cursorSmoothCaretAnimation: 'on' as const,
  cursorStyle: 'line' as const,
  cursorWidth: 2,
  mouseWheelZoom: false,
  automaticLayout: true,
  bracketPairColorization: { enabled: true },
  guides: { bracketPairs: true },
  suggest: { showKeywords: true },
  quickSuggestions: true,
}

export default function App() {
  const [lang, setLang] = useState<Language>('cpp')
  const [code, setCode] = useState(() => localStorage.getItem('codefightide.code') ?? STARTER.cpp)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [timeLimitMs, setTimeLimitMs] = useState(settings.timeLimitMs)
  const [memLimitMb, setMemLimitMb] = useState(settings.memoryLimitMb)
  const [snippets, setSnippets] = useState<CodeSnippet[]>(() => loadSnippets())
  const [compilers, setCompilers] = useState<CompilerInfo[]>([])
  const [backendReady, setBackendReady] = useState(false)
  const [backendChecking, setBackendChecking] = useState(true)
  const [backendStatus, setBackendStatus] = useState('Connecting to Rust backend…')
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<any>(null)
  const snippetActionRef = useRef<{ dispose: () => void } | null>(null)
  const [editorReady, setEditorReady] = useState(0)
  const [snippetFeedback, setSnippetFeedback] = useState<string | null>(null)
  const snippetFeedbackTimer = useRef<number | null>(null)

  const [compileResult, setCompileResult] = useState<CompileResult | null>(null)
  const [binaryPath, setBinaryPath] = useState<string | null>(null)
  const [compiling, setCompiling] = useState(false)
  const [running, setRunning] = useState(false)

  const [testcases, setTestcases] = useState<UITestCase[]>(() => { try { const x=JSON.parse(localStorage.getItem('codefightide.tests')||'null'); if(Array.isArray(x)&&x.length)return x } catch{} return [{ id: genId(), name: 'Sample 1', input: '5\n3 1 4 1 5', expected_output: '14' },{ id: genId(), name: 'Sample 2', input: '3\n10 20 30', expected_output: '60' }] })
  const [selectedTC, setSelectedTC] = useState<string | null>(testcases[0].id)
  const [panelTab, setPanelTab] = useState<PanelTab>('tests')
  const [compileError, setCompileError] = useState<string | undefined>()

  // Generator state
  const [genCode, setGenCode] = useState(DEFAULT_GENERATOR_CODE)
  const [genCompileResult, setGenCompileResult] = useState<CompileResult | undefined>()
  const [genBinary, setGenBinary] = useState<string | null>(null)

  // Brute / stress state
  const [bruteCode, setBruteCode] = useState(DEFAULT_BRUTE_CODE)
  const [bruteCompileResult, setBruteCompileResult] = useState<CompileResult | undefined>()
  const [bruteBinary, setBruteBinary] = useState<string | null>(null)

  // Settings panel
  const [showSettings, setShowSettings] = useState(false)

  // Right panel resize
  const [rightW, setRightW] = useState(420) // px
  const containerRef = useRef<HTMLDivElement>(null)

  const tmpDir = useRef<string>('/tmp/codefightide')
  useEffect(() => {
    let cancelled = false
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    const connectBackend = async () => {
      setBackendChecking(true)
      let lastError = 'Rust backend did not respond.'
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const status = await pingBackend()
          if (cancelled) return
          setBackendReady(status.ready)
          setBackendStatus(`${status.app} ${status.version} · ${status.platform}`)
          const d = await getTempDir()
          tmpDir.current = d + '/codefightide'
          const found = await detectCompilers()
          if (cancelled) return
          setCompilers(found)
          if (found.length > 0 && !settings.compilerPath) {
            patchSettings({ compilerPath: found[0].path })
          }
          setBackendChecking(false)
          return
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error)
          if (attempt < 4) await sleep(200)
        }
      }
      if (!cancelled) {
        setBackendReady(false)
        setBackendStatus(lastError)
        setBackendChecking(false)
      }
    }
    connectBackend()
    return () => { cancelled = true }
  }, [])
  useEffect(() => { const next={...settings,timeLimitMs,memoryLimitMb:memLimitMb}; setSettings(next); saveSettings(next) }, [timeLimitMs, memLimitMb])
  useEffect(() => saveSnippets(snippets), [snippets])

  useEffect(() => {
    applyGlassEffect(settings.glassEffect).catch(err => console.warn('Unable to apply window glass effect:', err))
  }, [settings.glassEffect])
  useEffect(() => {
    resetWebviewZoom().catch(err => console.warn('Unable to reset WebView zoom:', err))
  }, [])
  useEffect(() => { localStorage.setItem('codefightide.code', code); setBinaryPath(null) }, [code])
  useEffect(() => { localStorage.setItem('codefightide.tests', JSON.stringify(testcases)) }, [testcases])
  const patchSettings = useCallback((patch: Partial<AppSettings>) => { setSettings(prev => { const next={...prev,...patch}; saveSettings(next); return next }) }, [])
  const editorFontOptions = makeMonacoFontOptions(settings.fontSize, settings.editorFont, settings.fontLigatures)
  const setEditorFontSize = useCallback((value: number) => patchSettings({ fontSize: clampEditorFontSize(value) }), [patchSettings])

  // Monaco caches font metrics. Re-measure whenever the font family, ligatures or
  // zoom level changes; otherwise the caret/selection can drift from the glyphs.
  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      if (cancelled) return
      try {
        // Push font metrics directly into the live editor before re-measuring.
        // This avoids one render where WebView2 paints the new font while Monaco
        // still hit-tests using the previous character width.
        editorRef.current?.updateOptions?.(editorFontOptions)
        monacoRef.current?.editor?.remeasureFonts?.()
        editorRef.current?.layout?.()
        editorRef.current?.render?.(true)
      } catch {}
    }
    const raf = window.requestAnimationFrame(refresh)
    const timer = window.setTimeout(refresh, 120)
    const fontsReady = document.fonts?.ready
    fontsReady?.then(refresh).catch(() => {})
    return () => { cancelled = true; window.cancelAnimationFrame(raf); window.clearTimeout(timer) }
  }, [settings.fontSize, settings.editorFont, settings.fontLigatures, editorReady])
  const compileOptions = { compiler_path: settings.compilerPath || compilers[0]?.path || null, cpp_standard: settings.cppStandard, optimization: settings.optimization, extra_flags: splitFlags(settings.extraFlags) }
  const handleDetectCompilers = useCallback(async () => {
    try {
      const found = await detectCompilers()
      setCompilers(found)
      if (found.length > 0 && !settings.compilerPath) patchSettings({ compilerPath: found[0].path })
      if (found.length === 0) setCompileError('C++ compiler not found. Install GCC/MinGW/MSYS2 or select g++.exe manually.')
    } catch (error) {
      setCompileError(error instanceof Error ? error.message : String(error))
    }
  }, [settings.compilerPath, patchSettings])
  const handleSelectCompiler = useCallback(async () => {
    try {
      const path = await selectCompilerDialog()
      if (path) patchSettings({ compilerPath: path })
    } catch (error) {
      setCompileError(error instanceof Error ? error.message : String(error))
    }
  }, [patchSettings])

  // ── Compile ────────────────────────────────────────────────────────────────
  const handleCompile = useCallback(async (): Promise<CompileResult> => {
    setCompiling(true)
    setCompileError(undefined)
    setCompileResult(null)
    setBinaryPath(null)
    try {
      const result = await compileCode(code, lang, tmpDir.current, compileOptions)
      setCompileResult(result)
      if (result.success) {
        setBinaryPath(result.binary_path)
        setCompileError(undefined)
      } else {
        setCompileError(result.stderr || 'Compilation failed.')
        setPanelTab('output')
      }
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const failed: CompileResult = { success: false, exit_code: -1, stdout: '', stderr: message, compile_time_ms: 0, binary_path: '', diagnostics: [] }
      setCompileResult(failed)
      setCompileError(message)
      setPanelTab('output')
      pingBackend().then(status => setBackendReady(status.ready)).catch(() => setBackendReady(false))
      return failed
    } finally {
      setCompiling(false)
    }
  }, [code, lang, settings.compilerPath, settings.cppStandard, settings.optimization, settings.extraFlags, compilers])

  // ── Run one ────────────────────────────────────────────────────────────────
  const runOne = useCallback(async (tcId: string) => {
    const tc = testcases.find(t => t.id === tcId)
    if (!tc) return

    setRunning(true)
    setTestcases(prev => prev.map(t => t.id === tcId ? { ...t, verdict: 'running' as UIVerdict } : t))
    try {
      // Requirement: Save/current source -> compile -> run selected test.
      // Always compile here so a stale executable can never be judged.
      const compiled = await handleCompile()
      if (!compiled.success) {
        setTestcases(prev => prev.map(t => t.id === tcId ? { ...t, verdict: 'CE', actual_output: '', stderr: compiled.stderr, execution_time_ms: 0, memory_kb: 0 } : t))
        return
      }
      const r = await runTestcase(compiled.binary_path, lang, tc.input, tc.expected_output, timeLimitMs, memLimitMb, settings.compareMode)
      setTestcases(prev => prev.map(t => t.id === tcId ? {
        ...t,
        verdict: r.verdict,
        actual_output: r.stdout,
        stderr: r.stderr,
        execution_time_ms: r.execution_time_ms,
        memory_kb: r.memory_kb,
      } : t))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setTestcases(prev => prev.map(t => t.id === tcId ? { ...t, verdict: 'RE', actual_output: '', stderr: message, execution_time_ms: 0, memory_kb: 0 } : t))
      setCompileError(message)
      setPanelTab('output')
    } finally {
      setRunning(false)
    }
  }, [lang, testcases, timeLimitMs, memLimitMb, settings.compareMode, handleCompile])

  // ── Run all ────────────────────────────────────────────────────────────────
  const runAll = useCallback(async () => {
    setRunning(true)
    setPanelTab('output')
    setTestcases(prev => prev.map(t => ({ ...t, verdict: 'running' as UIVerdict })))
    try {
      // Compile exactly once for this Run All invocation, then reuse that binary.
      const compiled = await handleCompile()
      if (!compiled.success) {
        setTestcases(prev => prev.map(t => ({ ...t, verdict: 'CE', actual_output: '', stderr: compiled.stderr, execution_time_ms: 0, memory_kb: 0 })))
        return
      }
      const results = await runAllTestcases(
        compiled.binary_path,
        lang,
        testcases.map(t => ({ id: t.id, name: t.name, input: t.input, expected_output: t.expected_output })),
        timeLimitMs,
        memLimitMb,
        settings.compareMode,
      )
      setTestcases(prev => prev.map(t => {
        const r = results.find(r => r.id === t.id)
        if (!r) return t
        return { ...t, verdict: r.verdict, actual_output: r.actual_output, stderr: r.stderr, execution_time_ms: r.execution_time_ms, memory_kb: r.memory_kb }
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setTestcases(prev => prev.map(t => ({ ...t, verdict: 'RE', actual_output: '', stderr: message, execution_time_ms: 0, memory_kb: 0 })))
      setCompileError(message)
    } finally {
      setRunning(false)
    }
  }, [lang, testcases, timeLimitMs, memLimitMb, settings.compareMode, handleCompile])

  // ── Generator ──────────────────────────────────────────────────────────────
  const handleCompileGen = useCallback(async (): Promise<CompileResult> => {
    try {
      const r = await compileGenerator(genCode, tmpDir.current, compileOptions)
      setGenCompileResult(r)
      setGenBinary(r.success ? r.binary_path : null)
      return r
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const failed: CompileResult = { success:false, exit_code:-1, stdout:'', stderr:message, compile_time_ms:0, binary_path:'', diagnostics:[] }
      setGenCompileResult(failed)
      setGenBinary(null)
      return failed
    }
  }, [genCode, settings.compilerPath, settings.cppStandard, settings.optimization, settings.extraFlags, compilers])

  const handleGenerateInput = useCallback(async (seed: number): Promise<string> => {
    if (genBinary) return generateInput(genBinary, seed)
    const compiled = await handleCompileGen()
    if (!compiled.success) throw new Error(compiled.stderr || 'Generator compile failed')
    return generateInput(compiled.binary_path, seed)
  }, [genBinary, handleCompileGen])

  const addGeneratedToTests = useCallback((input: string) => {
    const tc: UITestCase = {
      id: genId(),
      name: `Gen #${testcases.length + 1}`,
      input,
      expected_output: '',
    }
    setTestcases(prev => [...prev, tc])
    setSelectedTC(tc.id)
    setPanelTab('tests')
  }, [testcases.length])

  // ── Stress ─────────────────────────────────────────────────────────────────
  const handleCompileBrute = useCallback(async (): Promise<CompileResult> => {
    try {
      const r = await compileBrute(bruteCode, tmpDir.current, compileOptions)
      setBruteCompileResult(r)
      setBruteBinary(r.success ? r.binary_path : null)
      return r
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const failed: CompileResult = { success:false, exit_code:-1, stdout:'', stderr:message, compile_time_ms:0, binary_path:'', diagnostics:[] }
      setBruteCompileResult(failed)
      setBruteBinary(null)
      return failed
    }
  }, [bruteCode, settings.compilerPath, settings.cppStandard, settings.optimization, settings.extraFlags, compilers])

  const handleStress = useCallback(async (iterations: number, startSeed: number): Promise<StressIteration[]> => {
    // Compile the exact code currently visible in all three editors and use the
    // binary paths returned by those compile calls directly. Do not depend on
    // React state (setBruteBinary/setGenBinary are asynchronous and previously
    // caused a freshly compiled brute to look "not compiled").
    const solution = await handleCompile()
    if (!solution.success) throw new Error(solution.stderr || 'Solution compile failed')

    const brute = await handleCompileBrute()
    if (!brute.success) throw new Error(brute.stderr || 'Brute-force compile failed')

    const generator = await handleCompileGen()
    if (!generator.success) throw new Error(generator.stderr || 'Generator compile failed')

    return runStressTest(
      solution.binary_path,
      brute.binary_path,
      generator.binary_path,
      iterations,
      timeLimitMs,
      memLimitMb,
      startSeed,
      settings.compareMode,
    )
  }, [timeLimitMs, memLimitMb, settings.compareMode, handleCompile, handleCompileBrute, handleCompileGen])

  // ── File ops ───────────────────────────────────────────────────────────────
  const handleOpen = useCallback(async () => {
    const result = await openFileDialog()
    if (!result) return
    setCode(result.content)
    setFilePath(result.path)
    setCompileResult(null)
    setBinaryPath(null)
  }, [])

  const handleSave = useCallback(async () => {
    const saved = await saveFileDialog(code, filePath ?? `solution.${LANG_EXT[lang]}`, filePath)
    if (saved) setFilePath(saved)
  }, [code, filePath, lang])

  useEffect(() => { if (!settings.autoSave || !filePath) return; const t=setTimeout(()=>{ saveFileDialog(code, filePath, filePath).catch(()=>{}) }, 700); return ()=>clearTimeout(t) }, [code,filePath,settings.autoSave])

  const handleNew = useCallback(() => { if (code.trim() && !confirm('Create a new file? Unsaved editor content will be replaced.')) return; setFilePath(null); setCode(STARTER[lang]); setCompileResult(null); setBinaryPath(null) }, [code,lang])

  const handleLangChange = useCallback((l: Language) => {
    setLang(l)
    if (!filePath) setCode(STARTER[l])
    setCompileResult(null)
    setBinaryPath(null)
  }, [filePath])

  // ── Resizer ────────────────────────────────────────────────────────────────
  const onResizeMouse = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = rightW
    const onMove = (mv: MouseEvent) => {
      const delta = startX - mv.clientX
      setRightW(Math.max(280, Math.min(700, startW + delta)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [rightW])

  // ── TC mutations ───────────────────────────────────────────────────────────
  const addTC = () => {
    const tc: UITestCase = { id: genId(), name: `Case ${testcases.length + 1}`, input: '', expected_output: '' }
    setTestcases(p => [...p, tc])
    setSelectedTC(tc.id)
    setPanelTab('tests')
  }
  const removeTC = (id: string) => {
    setTestcases(p => {
      const next = p.filter(t => t.id !== id)
      if (selectedTC === id) setSelectedTC(next[0]?.id ?? null)
      return next
    })
  }
  const updateTC = (id: string, patch: Partial<UITestCase>) => {
    setTestcases(p => p.map(t => t.id === id ? { ...t, ...patch } : t))
  }
  const duplicateTC = (id: string) => {
    const src = testcases.find(t => t.id === id); if (!src) return
    const copy = { ...src, id: genId(), name: `${src.name} Copy`, verdict: undefined, actual_output: undefined, stderr: undefined, execution_time_ms: undefined, memory_kb: undefined }
    setTestcases(p => [...p, copy]); setSelectedTC(copy.id)
  }
  const clearResults = () => setTestcases(p => p.map(({verdict,actual_output,stderr,execution_time_ms,memory_kb,...t}) => t))

  const showSnippetFeedback = useCallback((message: string) => {
    setSnippetFeedback(message)
    if (snippetFeedbackTimer.current !== null) window.clearTimeout(snippetFeedbackTimer.current)
    snippetFeedbackTimer.current = window.setTimeout(() => setSnippetFeedback(null), 1800)
  }, [])

  const expandSnippet = useCallback(() => {
    const editor = editorRef.current
    if (!editor || lang !== 'cpp') { showSnippetFeedback('Snippets are available in the C++ editor.'); return false }
    const model = editor.getModel()
    const pos = editor.getPosition()
    if (!model || !pos) { showSnippetFeedback('Editor is not ready.'); return false }

    const word = model.getWordUntilPosition(pos)
    const trigger = word.word.trim()
    const snip = findSnippet(snippets, trigger, 'cpp')
    if (!trigger) { showSnippetFeedback('Type a snippet trigger before the cursor, e.g. main or dij.'); return false }
    if (!snip) { showSnippetFeedback(`Snippet not found: ${trigger}`); return false }

    // IMPORTANT: never delete the trigger first. Let Monaco replace it atomically.
    // If snippet insertion ever fails, the user's source remains untouched.
    const versionBefore = model.getVersionId()
    editor.trigger('codefightide', 'editor.action.insertSnippet', {
      snippet: snip.body,
      overwriteBefore: trigger.length,
      overwriteAfter: 0,
    })

    // Some WebView/Monaco combinations do not expose the insertSnippet action.
    // Never fail silently: fall back to an atomic plain insertion so Ctrl+J
    // still expands the template instead of deleting/doing nothing.
    if (model.getVersionId() === versionBefore) {
      const rendered = renderSnippetFallback(snip.body)
      const startColumn = Math.max(1, pos.column - trigger.length)
      const range = {
        startLineNumber: pos.lineNumber,
        startColumn,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column,
      }
      const startOffset = model.getOffsetAt({ lineNumber: pos.lineNumber, column: startColumn })
      editor.executeEdits('cpstudio.expandSnippet.fallback', [{ range, text: rendered.text, forceMoveMarkers: true }])
      const cursor = model.getPositionAt(startOffset + rendered.cursorOffset)
      editor.setPosition(cursor)
    }
    editor.focus()
    showSnippetFeedback(`Expanded snippet: ${trigger}`)
    return true
  }, [snippets, lang, showSnippetFeedback])

  useEffect(() => {
    const editor=editorRef.current
    if(!editor) return
    snippetActionRef.current?.dispose()
    // Keep a Command Palette action, but keyboard dispatch is handled by the
    // capture-phase window listener below. This is more reliable in Tauri/WebView2
    // where Ctrl+J may otherwise be consumed before Monaco's keybinding service.
    snippetActionRef.current=editor.addAction({
      id:'codefightide.expandSnippet',
      label:'CP Studio: Expand Snippet',
      run:() => expandSnippet(),
    })
    return () => { snippetActionRef.current?.dispose(); snippetActionRef.current=null }
  }, [editorReady, expandSnippet])

  const goToDiagnostic = useCallback((diagnostic: CompilerDiagnostic) => {
    const editor = editorRef.current
    if (!editor) return
    editor.revealLineInCenter(diagnostic.line)
    editor.setPosition({ lineNumber: diagnostic.line, column: Math.max(1, diagnostic.column) })
    editor.focus()
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const inAnyMonaco = Boolean(target?.closest?.('.monaco-editor')) || Boolean(editorRef.current?.hasTextFocus?.())
      const ctrlOrMeta = e.ctrlKey || e.metaKey
      if (ctrlOrMeta && inAnyMonaco) {
        const zoomIn = e.key === '+' || e.key === '=' || e.code === 'NumpadAdd'
        const zoomOut = e.key === '-' || e.code === 'NumpadSubtract'
        const zoomReset = e.key === '0' || e.code === 'Numpad0'
        if (zoomIn || zoomOut || zoomReset) {
          e.preventDefault()
          e.stopPropagation()
          ;(e as any).stopImmediatePropagation?.()
          setEditorFontSize(zoomReset ? EDITOR_FONT_DEFAULT : settings.fontSize + (zoomIn ? 1 : -1))
          return
        }
      }

      const shortcut = eventShortcut(e)
      const kb = settings.keybindings
      let handled = true
      // Handle snippet expansion here, in capture phase, before WebView/Chromium
      // can consume Ctrl+J. Only hijack the shortcut while the main Monaco editor
      // has text focus, so Settings/input fields keep their normal behavior.
      if (shortcut === kb.expandSnippet) {
        if (editorRef.current?.hasTextFocus?.()) {
          e.preventDefault()
          e.stopPropagation()
          ;(e as any).stopImmediatePropagation?.()
          expandSnippet()
          return
        }
        handled = false
      }
      else if (shortcut === kb.runCurrent && selectedTC) runOne(selectedTC)
      else if (shortcut === kb.runAll) runAll()
      else if (shortcut === kb.compile) handleCompile()
      else if (shortcut === kb.newTest) addTC()
      else handled = false
      if (handled) e.preventDefault()
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='s') { e.preventDefault(); handleSave() }
    }
    window.addEventListener('keydown', h, true); return () => window.removeEventListener('keydown', h, true)
  }, [settings.keybindings, settings.fontSize, setEditorFontSize, expandSnippet, selectedTC, runOne, runAll, handleCompile, handleSave])

  const newSnippet = () => { const trigger=prompt('Snippet trigger (example: myseg)')?.trim(); if(!trigger)return; const name=prompt('Snippet name')?.trim()||trigger; const body=prompt('Snippet body (Monaco placeholders like ${1:name} and $0 are supported)'); if(body==null)return; setSnippets(p=>[...p,{id:`custom-${Date.now()}`,trigger,name,body,language:'cpp',category:'Custom',description:name,enabled:true}]) }
  const exportSnippets = () => { const custom=snippets.filter(x=>x.id.startsWith('custom-')); const blob=new Blob([JSON.stringify(custom,null,2)],{type:'application/json'}); const u=URL.createObjectURL(blob); const a=document.createElement('a');a.href=u;a.download='codefight-snippets.json';a.click();URL.revokeObjectURL(u) }
  const importSnippets = () => { const i=document.createElement('input');i.type='file';i.accept='.json';i.onchange=()=>{const f=i.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const list=JSON.parse(String(r.result));if(Array.isArray(list))setSnippets(p=>[...p,...list.map((x:any)=>({...x,id:`custom-${Date.now()}-${Math.random()}`,enabled:x.enabled!==false,language:x.language||'cpp',category:x.category||'Custom'}))])}catch{alert('Invalid snippet JSON')}};r.readAsText(f)};i.click() }

  // ── Status bar summary ─────────────────────────────────────────────────────
  const ranCount = testcases.filter(t => t.verdict && !['idle', 'running'].includes(t.verdict!)).length
  const acCount = testcases.filter(t => t.verdict === 'AC').length
  const overallVerdict = running ? 'running'
    : ranCount === 0 ? null
    : acCount === ranCount ? 'AC'
    : testcases.find(t => t.verdict === 'TLE') ? 'TLE'
    : testcases.find(t => t.verdict === 'MLE') ? 'MLE'
    : testcases.find(t => t.verdict === 'RE') ? 'RE'
    : 'WA'

  const VERDICT_COLOR: Record<string, string> = {
    AC: '#30d158', WA: '#ff453a', TLE: '#ff9f0a', MLE: '#bf5af2', RE: '#ff453a', running: '#0a84ff',
  }

  // Keep the WebView itself transparent. The native Windows material (Acrylic /
  // Blur / Mica) is the backdrop; React only adds a light tint for readability.
  const glassOn = settings.glassEffect !== 'off'
  const activeGlassOpacity = settings.glassEffect === 'off' ? 1 : settings.glassOpacityByEffect[settings.glassEffect]
  const tint = Math.max(0.05, Math.min(0.90, activeGlassOpacity))
  const glassBg = (extra = 0) => `rgba(10,10,13,${Math.min(0.92, tint + extra).toFixed(3)})`
  const editorShade = Math.max(0, Math.min(0.85, settings.editorShadeOpacity))

  return (
    <div className={settings.glassEffect !== 'off' ? 'glass-active' : ''} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: glassOn ? 'transparent' : '#0a0a0c', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>
      <WindowResizeHandles />

      {/* ── Title Bar ── */}
      <div data-tauri-drag-region onDoubleClick={e => { if (e.target === e.currentTarget) toggleMaximizeWindow().catch(console.error) }} style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        background: glassOn ? glassBg(0.06) : 'rgba(16,16,18,0.99)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
        padding: '0 14px',
        userSelect: 'none',
      }}>
        {/* Native window controls for the borderless Tauri window */}
        <div style={{ display: 'flex', gap: 3, marginRight: 10 }}>
          <WindowButton label="Minimize" onClick={() => minimizeWindow().catch(console.error)} icon={Minus} />
          <WindowButton label="Maximize / Restore" onClick={() => toggleMaximizeWindow().catch(console.error)} icon={Maximize2} />
          <WindowButton label="Close" onClick={() => closeWindow().catch(console.error)} icon={X} danger />
        </div>

        {/* CP Studio brand / drag handle */}
        <div
          data-tauri-drag-region
          onDoubleClick={() => toggleMaximizeWindow().catch(console.error)}
          style={{ display: 'flex', alignItems: 'center', marginRight: 18, cursor: 'default', minWidth: 0 }}
        >
          <CPStudioBrand />
        </div>

        {/* File tab */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 12px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.09)',
          color: '#e8e8ed',
          fontSize: 12,
          fontFamily: 'JetBrains Mono, monospace',
          marginRight: 12,
        }}>
          {compileResult && !compileResult.success
            ? <Circle size={8} fill="#ff453a" color="#ff453a" />
            : binaryPath
            ? <Circle size={8} fill="#30d158" color="#30d158" />
            : <Circle size={8} color="#636366" />
          }
          {filePath ? filePath.split('/').pop() : `solution.${LANG_EXT[lang]}`}
        </div>

        {/* File actions */}
        <TBarBtn onClick={handleNew} label="New" icon={FilePlus2} /><TBarBtn onClick={handleOpen} label="Open" icon={FolderOpen} />
        <TBarBtn onClick={handleSave} label="Save" icon={Save} />

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', margin: '0 8px' }} />

        {/* Language */}
        <select
          value={lang}
          onChange={e => handleLangChange(e.target.value as Language)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            color: '#e8e8ed',
            fontSize: 12,
            padding: '3px 24px 3px 8px',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            marginRight: 8,
          }}
        >
          <option value="cpp">C++ ({settings.cppStandard})</option>
          <option value="python">Python 3</option>
          <option value="java">Java 21</option>
        </select>

        {/* Compile */}
        <button
          onClick={handleCompile}
          disabled={compiling || backendChecking || !backendReady}
          style={{
            padding: '4px 12px',
            background: compileResult?.success ? 'rgba(48,209,88,0.12)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${compileResult?.success ? 'rgba(48,209,88,0.25)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 6,
            color: compileResult?.success ? '#30d158' : compileResult && !compileResult.success ? '#ff453a' : '#98989d',
            fontSize: 12,
            cursor: compiling || backendChecking || !backendReady ? 'not-allowed' : 'pointer',
            opacity: compiling || backendChecking || !backendReady ? 0.6 : 1,
            marginRight: 6,
          }}
        >
          {compiling ? <><LoaderCircle size={13} className="spin-icon" /> Compiling…</> : compileResult?.success ? <><Check size={13} /> Compiled</> : <><Hammer size={13} /> Compile</>}
        </button>

        <div data-tauri-drag-region onDoubleClick={() => toggleMaximizeWindow().catch(console.error)} style={{ flex: 1, alignSelf: 'stretch' }} />

        {/* Settings */}
        <button
          onClick={() => setShowSettings(s => !s)}
          style={{
            padding: '4px 10px',
            background: showSettings ? 'rgba(10,132,255,0.15)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${showSettings ? 'rgba(10,132,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 6,
            color: showSettings ? '#0a84ff' : '#636366',
            fontSize: 11,
            cursor: 'pointer',
            marginRight: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Settings size={13} /> {timeLimitMs}ms · {memLimitMb}MB
        </button>

        {running && <button onClick={async()=>{await stopProcesses();setRunning(false)}} style={{padding:'5px 12px',background:'rgba(255,69,58,0.13)',border:'1px solid rgba(255,69,58,0.3)',borderRadius:7,color:'#ff453a',fontSize:12,cursor:'pointer',marginRight:6,display:'flex',alignItems:'center',gap:5}}><Square size={12} /> Stop</button>}

        {/* Run All */}
        <button
          onClick={runAll}
          disabled={running || testcases.length === 0 || backendChecking || !backendReady}
          style={{
            padding: '5px 16px',
            background: running ? 'rgba(10,132,255,0.5)' : '#0a84ff',
            border: 'none',
            borderRadius: 7,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: running || testcases.length === 0 || backendChecking || !backendReady ? 'not-allowed' : 'pointer',
            opacity: running || testcases.length === 0 || backendChecking || !backendReady ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            letterSpacing: '-0.01em',
          }}
        >
          {running
            ? <><LoaderCircle size={13} className="spin-icon" /> Running…</>
            : <><Play size={13} /> Run All</>
          }
        </button>
      </div>

      {backendChecking ? (
        <div style={{height:34,display:'flex',alignItems:'center',gap:8,padding:'0 14px',background:'rgba(10,132,255,0.08)',borderBottom:'1px solid rgba(10,132,255,0.20)',color:'#64a8ff',fontSize:12,flexShrink:0}}>
          <LoaderCircle size={14} className="spin-icon" /> Connecting to native Rust backend…
        </div>
      ) : !backendReady ? (
        <div style={{minHeight:34,display:'flex',alignItems:'center',gap:8,padding:'7px 14px',background:'rgba(255,69,58,0.10)',borderBottom:'1px solid rgba(255,69,58,0.25)',color:'#ff6961',fontSize:12,flexShrink:0}}>
          <AlertTriangle size={14} /> Native backend connection failed: {backendStatus}. Launch with <code style={{color:'#fff'}}>npm run tauri dev</code>; the Tauri dev URL must be port 8443 for this project.
        </div>
      ) : null}

      {snippetFeedback && (
        <div style={{position:'fixed',left:14,bottom:30,zIndex:250,padding:'7px 10px',borderRadius:7,background:'rgba(28,28,30,0.94)',border:'1px solid rgba(10,132,255,0.28)',boxShadow:'0 8px 28px rgba(0,0,0,0.45)',color:'#d9eaff',fontSize:11,fontFamily:'JetBrains Mono, monospace',pointerEvents:'none'}}>
          {snippetFeedback}
        </div>
      )}

      {/* ── Settings Popover ── */}
      {showSettings && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={() => setShowSettings(false)} />
          <div style={{
            position: 'fixed',
            top: 48,
            right: 14,
            width: 390,
            background: glassOn ? glassBg(0.26) : 'rgba(26,26,28,0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: 18,
            zIndex: 99,
            maxHeight: 'calc(100vh - 64px)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            scrollbarGutter: 'stable',
            boxShadow: '0 24px 70px rgba(0,0,0,0.7)',
          }}>
            <p style={{ margin: '0 0 14px', color: '#636366', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Execution Limits
            </p>
            <LimitSlider label="Time Limit" value={timeLimitMs} unit="ms" min={100} max={10000} step={100}
              presets={[500, 1000, 2000, 3000, 5000]} color="#ff9f0a" onChange={setTimeLimitMs} />
            <LimitSlider label="Memory Limit" value={memLimitMb} unit="MB" min={16} max={1024} step={16}
              presets={[64, 128, 256, 512]} color="#bf5af2" onChange={setMemLimitMb} />
            <p style={{ margin: '12px 0 8px', color: '#636366', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Compiler & Judge</p>
            <SettingRow label="C++ Standard"><select value={settings.cppStandard} onChange={e=>patchSettings({cppStandard:e.target.value})} style={settingInputStyle}><option>gnu++17</option><option>gnu++20</option><option>gnu++23</option></select></SettingRow>
            <SettingRow label="Compiler"><div style={{display:'flex',gap:4,alignItems:'center'}}><input value={settings.compilerPath} onChange={e=>patchSettings({compilerPath:e.target.value})} placeholder={compilers[0]?.path || 'g++ (auto detect)'} style={{...settingInputStyle,width:135}}/><button onClick={handleDetectCompilers} style={miniBtn}>Auto</button><button onClick={handleSelectCompiler} style={miniBtn}>Browse</button></div></SettingRow>
            <SettingRow label="Optimization"><select value={settings.optimization} onChange={e=>patchSettings({optimization:e.target.value})} style={settingInputStyle}><option>-O0</option><option>-O1</option><option>-O2</option><option>-O3</option></select></SettingRow>
            <SettingRow label="Extra flags"><input value={settings.extraFlags} onChange={e=>patchSettings({extraFlags:e.target.value})} style={settingInputStyle}/></SettingRow>
            <SettingRow label="Compare"><select value={settings.compareMode} onChange={e=>patchSettings({compareMode:e.target.value as CompareMode})} style={settingInputStyle}><option value="exact">Exact</option><option value="trim">Trim whitespace</option><option value="tokens">Token based</option></select></SettingRow>
            <p style={{ margin: '12px 0 8px', color: '#636366', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Appearance</p>
            <SettingRow label="Glass effect"><select value={settings.glassEffect} onChange={e=>patchSettings({glassEffect:e.target.value as AppSettings['glassEffect']})} style={settingInputStyle}><option value="off">Off</option><option value="vibrancy">Vibrancy / Blur (recommended)</option><option value="acrylic">Acrylic</option><option value="mica">Mica (wallpaper tint)</option><option value="blur">Legacy Blur (Win10 / older Win11)</option></select></SettingRow>
            {(['vibrancy','acrylic','mica','blur'] as const).map(material => {
              const transparency = Math.round((1 - settings.glassOpacityByEffect[material]) * 100)
              const label = material === 'vibrancy' ? 'Vibrancy transparency' : material === 'acrylic' ? 'Acrylic transparency' : material === 'mica' ? 'Mica transparency' : 'Blur transparency'
              return <SettingRow key={material} label={label}><div style={{display:'flex',alignItems:'center',gap:8,opacity:settings.glassEffect===material || (material==='vibrancy' && settings.glassEffect==='vibrancy') ? 1 : 0.72}}><input type="range" min={10} max={95} step={1} value={transparency} onChange={e=>{ const opacity=1-(Number(e.target.value)/100); patchSettings({glassOpacityByEffect:{...settings.glassOpacityByEffect,[material]:opacity}}) }} style={{width:120}} /><span style={{fontSize:10,color:'#636366',width:34,textAlign:'right'}}>{transparency}%</span></div></SettingRow>
            })}
            <SettingRow label="Editor transparency"><div style={{display:'flex',alignItems:'center',gap:8}}><input type="range" min={15} max={100} step={1} value={Math.round((1-settings.editorShadeOpacity)*100)} onChange={e=>patchSettings({editorShadeOpacity:Math.max(0,Math.min(0.85,1-(Number(e.target.value)/100)))})} style={{width:120}} /><span style={{fontSize:10,color:'#636366',width:34,textAlign:'right'}}>{Math.round((1-settings.editorShadeOpacity)*100)}%</span></div></SettingRow>
            <p style={{margin:'4px 0 8px',color:'#4f4f56',fontSize:10}}>Each native material keeps its own transparency. If wallpaper makes code hard to read, lower Editor transparency (adds a darker editor surface).</p>
            <p style={{ margin: '12px 0 8px', color: '#636366', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Editor & Shortcuts</p>
            <SettingRow label="Editor font"><select value={settings.editorFont} onChange={e=>patchSettings({editorFont:e.target.value as AppSettings['editorFont']})} style={settingInputStyle}><option value="codeblocks">Consolas (Code::Blocks)</option><option value="jetbrains">JetBrains Mono / fallback</option></select></SettingRow>
            <SettingRow label="Font size"><div style={{display:'flex',alignItems:'center',gap:4}}><button onClick={()=>setEditorFontSize(settings.fontSize-1)} style={miniBtn} title="Ctrl+-"><Minus size={11}/></button><input type="number" min={EDITOR_FONT_MIN} max={EDITOR_FONT_MAX} value={settings.fontSize} onChange={e=>setEditorFontSize(Number(e.target.value))} style={{...settingInputStyle,width:70,textAlign:'center'}}/><button onClick={()=>setEditorFontSize(settings.fontSize+1)} style={miniBtn} title="Ctrl++"><Plus size={11}/></button></div></SettingRow>
            <SettingRow label="Operator ligatures"><label style={{display:'flex',alignItems:'center',gap:6,color:'#98989d',fontSize:10}}><input type="checkbox" disabled={settings.editorFont==='codeblocks'} checked={settings.editorFont==='codeblocks' ? false : settings.fontLigatures} onChange={e=>patchSettings({fontLigatures:e.target.checked})}/><span>{settings.editorFont==='codeblocks' ? 'Code::Blocks mode: literal operators (!=, <=, ->)' : settings.fontLigatures ? 'Joined glyphs' : 'Literal operators (!=, <=, ->)'}</span></label></SettingRow>
            <p style={{margin:'4px 0 8px',color:'#4f4f56',fontSize:10}}>Ctrl++ / Ctrl+- zoom only the code editor by 1 px; Ctrl+0 resets to 14 px. CP Studio locks WebView zoom to 100% so mouse hit-testing stays aligned with the caret.</p>
            <SettingRow label="Minimap"><input type="checkbox" checked={settings.minimap} onChange={e=>patchSettings({minimap:e.target.checked})}/></SettingRow><SettingRow label="Auto save"><input type="checkbox" checked={settings.autoSave} onChange={e=>patchSettings({autoSave:e.target.checked})}/></SettingRow>
            {Object.entries(settings.keybindings).map(([action,key])=><div key={action}><SettingRow label={action}><input value={key} onChange={e=>patchSettings({keybindings:{...settings.keybindings,[action]:e.target.value}})} style={settingInputStyle}/></SettingRow></div>)}
            {new Set(Object.values(settings.keybindings)).size !== Object.values(settings.keybindings).length && <p style={{margin:'6px 0',color:'#ff9f0a',fontSize:11}}><AlertTriangle size={12} /> Keybinding conflict detected. Change one of the duplicated shortcuts.</p>}
            <p style={{ margin: '12px 0 6px', color: '#636366', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Snippets ({snippets.filter(x=>x.enabled).length})</p>
            <div style={{display:'flex',gap:5,marginBottom:6}}><button onClick={newSnippet} style={miniBtn}><Plus size={11} /> New</button><button onClick={importSnippets} style={miniBtn}>Import</button><button onClick={exportSnippets} style={miniBtn}>Export</button></div>
            <div style={{maxHeight:110,overflow:'auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>{snippets.map(sn=><label key={sn.id} style={{fontSize:11,color:'#98989d',display:'flex',gap:5,alignItems:'center'}}><input type="checkbox" checked={sn.enabled} onChange={e=>setSnippets(p=>p.map(x=>x.id===sn.id?{...x,enabled:e.target.checked}:x))}/><code style={{color:'#0a84ff'}}>{sn.trigger}</code> <span style={{overflow:'hidden',textOverflow:'ellipsis'}}>{sn.name}</span>{sn.id.startsWith('custom-')&&<button onClick={e=>{e.preventDefault();setSnippets(p=>p.filter(x=>x.id!==sn.id))}} style={{marginLeft:'auto',background:'none',border:0,color:'#ff453a',cursor:'pointer'}}><Trash2 size={11} /></button>}</label>)}</div>
            <p style={{ margin: '10px 0 0', color: '#48484a', fontSize: 11 }}>Settings and snippets persist in the app profile. Compiler detected: {compilers.map(c=>`${c.name}: ${c.path}`).join(' · ') || 'not found yet'}.</p>
          </div>
        </>
      )}

      {/* ── Main ── */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 300 }}>
          {/* Editor tab bar */}
          <div style={{
            height: 34,
            display: 'flex',
            alignItems: 'stretch',
            background: glassOn ? glassBg(0.02) : 'rgba(14,14,16,0.99)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 14px',
              borderRight: '1px solid rgba(255,255,255,0.06)',
              color: '#e8e8ed',
              fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace',
              background: 'rgba(255,255,255,0.035)',
              borderBottom: '2px solid #0a84ff',
              marginBottom: -1,
            }}>
              <Circle size={8} fill={binaryPath ? '#30d158' : '#0a84ff'} color={binaryPath ? '#30d158' : '#0a84ff'} />
              {filePath ? filePath.split('/').pop() : `solution.${LANG_EXT[lang]}`}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 14, color: '#636366', fontSize: 11 }}>
              {code.split('\n').length} ln · {code.length} ch · {settings.fontSize}px · {Math.round((settings.fontSize / EDITOR_FONT_DEFAULT) * 100)}%
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'hidden', background: glassOn ? `rgba(7,7,10,${editorShade.toFixed(3)})` : '#0d0d10' }}>
            <MonacoEditor
              height="100%"
              loading={<EditorLoadingScreen message="Loading CP Studio code editor…" />}
              language={LANG_MONACO[lang]}
              value={code}
              onChange={v => { setCode(v ?? ''); setCompileResult(null); setCompileError(undefined) }}
              beforeMount={installCpStudioMonacoTheme}
              theme={CP_STUDIO_GLASS_THEME}
              options={{...EDITOR_OPTS,...editorFontOptions,tabSize:settings.tabSize,minimap:{...EDITOR_OPTS.minimap,enabled:settings.minimap}}}
              onMount={(editor, monaco) => {
                editorRef.current = editor
                monacoRef.current = monaco
                editor.updateOptions(editorFontOptions)
                monaco.editor.remeasureFonts()
                editor.layout()
                requestAnimationFrame(() => { monaco.editor.remeasureFonts(); editor.layout(); editor.render(true) })
                setEditorReady(v => v + 1)
                editor.focus()
              }}
            />
          </div>

          {/* Status bar */}
          <div style={{
            height: 22,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            background: overallVerdict && overallVerdict !== 'running'
              ? (VERDICT_COLOR[overallVerdict] ?? '#0a84ff') + '22'
              : '#0a84ff',
            borderTop: overallVerdict && overallVerdict !== 'running'
              ? `1px solid ${VERDICT_COLOR[overallVerdict] ?? '#0a84ff'}44`
              : 'none',
            gap: 10,
            flexShrink: 0,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
              {lang === 'cpp' ? `${settings.cppStandard} · GCC` : lang === 'python' ? 'Python 3' : 'Java 21'}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>·</span>
            {compileResult?.success && <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}><Check size={11} /> Compiled</span>}
            {compileError && <span style={{ color: '#ff9f0a', fontSize: 11 }}><AlertTriangle size={11} /> Compile Error</span>}
            <div style={{ flex: 1 }} />
            {overallVerdict && (
              <span style={{ color: VERDICT_COLOR[overallVerdict] ?? '#0a84ff', fontSize: 11, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
                {overallVerdict === 'running' ? <><LoaderCircle size={11} className="spin-icon" /> Running…</>
                  : overallVerdict === 'AC' ? <><Check size={11} /> AC {acCount}/{ranCount}</>
                  : `${overallVerdict} ${acCount}/${ranCount}`}
              </span>
            )}
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
              <Clock3 size={11} /> {timeLimitMs}ms · <MemoryStick size={11} /> {memLimitMb}MB
            </span>
          </div>
        </div>

        {/* Resizer */}
        <div
          onMouseDown={onResizeMouse}
          style={{
            width: 4,
            flexShrink: 0,
            background: 'rgba(255,255,255,0.03)',
            cursor: 'col-resize',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(10,132,255,0.4)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        />

        {/* Right panel */}
        <div style={{
          width: rightW,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: glassOn ? glassBg(0.04) : 'rgba(14,14,16,0.97)',
        }}>
          {/* Panel tab bar */}
          <div style={{
            height: 34,
            display: 'flex',
            alignItems: 'stretch',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            flexShrink: 0,
            overflowX: 'auto',
            overflowY: 'hidden',
            background: glassOn ? glassBg(0.02) : 'rgba(14,14,16,0.99)',
          }}>
            {([ ['tests', 'Tests', FlaskConical], ['output', 'Output', BarChart3], ['generator', 'Generator', Dices], ['stress', 'Stress', Swords] ] as [PanelTab, string, LucideIcon][]).map(([tab, label, Icon]) => (
              <button
                key={tab}
                onClick={() => setPanelTab(tab)}
                style={{
                  padding: '0 12px',
                  background: 'none',
                  border: 'none',
                  borderBottom: panelTab === tab ? '2px solid #0a84ff' : '2px solid transparent',
                  color: panelTab === tab ? '#e8e8ed' : '#636366',
                  fontSize: 11,
                  fontWeight: panelTab === tab ? 500 : 400,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  whiteSpace: 'nowrap',
                  marginBottom: -1,
                  transition: 'color 0.12s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {panelTab === 'tests' && (
              <TestsPanel
                testcases={testcases}
                selected={selectedTC}
                onSelect={setSelectedTC}
                onAdd={addTC}
                onRemove={removeTC}
                onDuplicate={duplicateTC}
                onClearResults={clearResults}
                onUpdate={updateTC}
                onRunOne={runOne}
                onRunAll={runAll}
                running={running}
                timeLimitMs={timeLimitMs}
                memLimitMb={memLimitMb}
                nativeReady={backendReady}
              />
            )}
            {panelTab === 'output' && (
              <OutputPanel
                testcases={testcases}
                timeLimitMs={timeLimitMs}
                memLimitMb={memLimitMb}
                compileError={compileError}
                diagnostics={compileResult?.diagnostics}
                onDiagnosticClick={goToDiagnostic}
              />
            )}
            {panelTab === 'generator' && (
              <GeneratorPanel
                code={genCode}
                onChange={v => { setGenCode(v); setGenBinary(null); setGenCompileResult(undefined) }}
                onCompile={handleCompileGen}
                onGenerate={handleGenerateInput}
                onAddToTests={addGeneratedToTests}
                compileResult={genCompileResult}
                nativeReady={backendReady}
                editorFontOptions={editorFontOptions}
                editorShadeOpacity={editorShade}
              />
            )}
            {panelTab === 'stress' && (
              <StressPanel
                bruteCode={bruteCode}
                onBruteChange={v => { setBruteCode(v); setBruteBinary(null); setBruteCompileResult(undefined) }}
                onCompileBrute={handleCompileBrute}
                onRunStress={handleStress}
                bruteCompileResult={bruteCompileResult}
                generatorReady={!!genBinary}
                solutionReady={!!binaryPath}
                onAddToTests={addGeneratedToTests}
                onStop={stopProcesses}
                nativeReady={backendReady}
                editorFontOptions={editorFontOptions}
                editorShadeOpacity={editorShade}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function WindowButton({ label, onClick, icon: Icon, danger=false }: { label:string; onClick:()=>void; icon:LucideIcon; danger?:boolean }) {
  return <button title={label} aria-label={label} onClick={e=>{e.stopPropagation();onClick()}} style={{width:28,height:26,display:'grid',placeItems:'center',padding:0,background:'transparent',border:'none',borderRadius:5,color:danger?'#ff6961':'#98989d',cursor:'pointer'}}><Icon size={13}/></button>
}

function WindowResizeHandles() {
  const h=(direction:ResizeDirection,cursor:string,style:React.CSSProperties)=><div key={direction} onMouseDown={e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();startWindowResize(direction).catch(console.error)}} style={{position:'fixed',zIndex:1000,cursor,...style}} />
  return <>{[
    h('North','ns-resize',{top:0,left:8,right:8,height:5}),
    h('South','ns-resize',{bottom:0,left:8,right:8,height:5}),
    h('West','ew-resize',{left:0,top:8,bottom:8,width:5}),
    h('East','ew-resize',{right:0,top:8,bottom:8,width:5}),
    h('NorthWest','nwse-resize',{left:0,top:0,width:9,height:9}),
    h('NorthEast','nesw-resize',{right:0,top:0,width:9,height:9}),
    h('SouthWest','nesw-resize',{left:0,bottom:0,width:9,height:9}),
    h('SouthEast','nwse-resize',{right:0,bottom:0,width:9,height:9}),
  ]}</>
}

function TBarBtn({ onClick, label, icon: Icon }: { onClick: () => void; label: string; icon: LucideIcon }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        padding: '3px 8px',
        background: 'none',
        border: 'none',
        borderRadius: 5,
        color: '#636366',
        fontSize: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#e8e8ed' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#636366' }}
    >
      <Icon size={13} /> <span style={{ fontSize: 11 }}>{label}</span>
    </button>
  )
}

const miniBtn: React.CSSProperties={padding:'2px 7px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:5,color:'#98989d',fontSize:10,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:4}
const settingInputStyle: React.CSSProperties = { width: 190, padding: '3px 7px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, color:'#e8e8ed', fontSize:11, outline:'none' }
function SettingRow({label,children}:{label:string;children:React.ReactNode}) { return <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:6}}><span style={{color:'#98989d',fontSize:11}}>{label}</span>{children}</div> }

function LimitSlider({ label, value, unit, min, max, step, presets, color, onChange }: {
  label: string; value: number; unit: string; min: number; max: number; step: number;
  presets: number[]; color: string; onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: '#98989d', fontSize: 12 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={e => onChange(Number(e.target.value))}
            style={{
              width: 68,
              padding: '2px 6px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 5,
              color: '#e8e8ed',
              fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace',
              textAlign: 'right',
              outline: 'none',
            }}
          />
          <span style={{ color: '#636366', fontSize: 11 }}>{unit}</span>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color }} />
      <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
        {presets.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={{
              padding: '1px 8px',
              background: value === p ? `${color}22` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${value === p ? color + '44' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 4,
              color: value === p ? color : '#48484a',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
