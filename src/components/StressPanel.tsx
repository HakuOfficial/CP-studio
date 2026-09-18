import MonacoEditor from '@monaco-editor/react'
import { CP_STUDIO_GLASS_THEME, installCpStudioMonacoTheme } from '../editor/monacoTheme'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, BarChart3, Hammer, LoaderCircle, Plus, Play, Square, Wrench } from 'lucide-react'
import type { CompileResult, StressIteration } from '../types'
import type { MonacoFontOptions } from '../editor/editorAppearance'
import StatusBadge from './StatusBadge'
import OutputDiff from './OutputDiff'

interface Props {
  bruteCode: string
  onBruteChange: (v: string) => void
  onCompileBrute: () => Promise<CompileResult>
  onRunStress: (iterations: number, startSeed: number) => Promise<StressIteration[]>
  bruteCompileResult?: CompileResult
  generatorReady: boolean
  solutionReady: boolean
  onAddToTests: (input: string) => void
  onStop: () => Promise<void>
  nativeReady: boolean
  editorFontOptions: MonacoFontOptions
  editorShadeOpacity: number
}

export const DEFAULT_BRUTE_CODE = `#include <bits/stdc++.h>
using namespace std;

// Brute-force / reference solution
// Must produce correct output (may be slow)

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int n;
    cin >> n;
    vector<int> a(n);
    for (int& x : a) cin >> x;

    // O(n^2) or simple correct solution
    long long ans = 0;
    for (int x : a) ans += x;
    cout << ans << "\\n";

    return 0;
}
`

export default function StressPanel({
  bruteCode, onBruteChange, onCompileBrute, onRunStress,
  bruteCompileResult, generatorReady, solutionReady, onAddToTests, onStop, nativeReady, editorFontOptions, editorShadeOpacity,
}: Props) {
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<any>(null)
  const [iterations, setIterations] = useState(20)
  const [startSeed, setStartSeed] = useState(1)
  const [results, setResults] = useState<StressIteration[]>([])
  const [running, setRunning] = useState(false)
  const [compiling, setCompiling] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'brute' | 'results'>('brute')
  const [runError, setRunError] = useState<string | null>(null)

  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return
    editor.updateOptions(editorFontOptions)
    monaco.editor.remeasureFonts()
    editor.layout()
    requestAnimationFrame(() => { monaco.editor.remeasureFonts(); editor.layout(); editor.render(true) })
  }, [editorFontOptions.fontSize, editorFontOptions.lineHeight, editorFontOptions.fontFamily, editorFontOptions.fontLigatures])

  const handleCompile = async () => {
    setCompiling(true)
    try { return await onCompileBrute() } finally { setCompiling(false) }
  }

  const handleRun = async () => {
    setRunning(true)
    setRunError(null)
    setResults([])
    setSelected(null)
    try {
      // App compiles Solution + Brute + Generator from the current editor text
      // and passes their returned binary paths directly into the stress runner.
      const res = await onRunStress(iterations, startSeed)
      setResults(res)
      const fail = res.findIndex(r => r.verdict !== 'AC')
      if (fail >= 0) setSelected(fail)
      setActiveTab('results')
    } catch (error) {
      setRunError(error instanceof Error ? error.message : String(error))
    } finally {
      setRunning(false)
    }
  }

  const acCount = results.filter(r => r.verdict === 'AC').length
  const failed = results.find(r => r.verdict !== 'AC')
  const selResult = selected !== null ? results[selected] : null

  const ready = nativeReady

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 7, padding: 2 }}>
          {(['brute', 'results'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: '3px 10px',
                background: activeTab === t ? 'rgba(10,132,255,0.25)' : 'none',
                border: 'none',
                borderRadius: 5,
                color: activeTab === t ? '#0a84ff' : '#636366',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontWeight: activeTab === t ? 600 : 400,
              }}
            >
              {t === 'brute' ? <><Wrench size={12} /> Brute Force</> : <><BarChart3 size={12} /> Results{results.length ? ` (${acCount}/${results.length})` : ''}</>}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <span style={{ color: '#636366', fontSize: 11 }}>
          <AlertTriangle size={12} /> Solution + Brute + Generator compile automatically
        </span>

        <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#98989d', fontSize: 11 }}>
          Iters
          <input type="number" value={iterations} min={1} max={1000}
            onChange={e => setIterations(Number(e.target.value))}
            style={numInputStyle(60)} />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#98989d', fontSize: 11 }}>
          Seed
          <input type="number" value={startSeed} min={0}
            onChange={e => setStartSeed(Number(e.target.value))}
            style={numInputStyle(60)} />
        </label>

        <button onClick={handleCompile} disabled={compiling || !nativeReady} style={btnStyle('#ff9f0a', compiling)}>
          {compiling ? <LoaderCircle size={13} className="spin-icon" /> : <Hammer size={13} />} Compile Brute
        </button>

        {running && <button onClick={async()=>{await onStop();setRunning(false)}} style={btnStyle('#ff453a',false)}><Square size={12} /> Stop</button>}
        <button onClick={handleRun} disabled={running || !nativeReady} style={btnStyle('#0a84ff', running || !nativeReady)}>
          {running ? (
            <><LoaderCircle size={13} className="spin-icon" /> Running…</>
          ) : <><Play size={13} /> Stress Test</>}
        </button>
      </div>

      {runError && (
        <div style={{padding:'7px 10px',background:'rgba(255,69,58,0.10)',borderBottom:'1px solid rgba(255,69,58,0.22)',color:'#ff6961',fontSize:11,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
          <AlertTriangle size={12} /> {runError}
        </div>
      )}

      {activeTab === 'brute' ? (
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: `rgba(7,7,10,${Math.max(0, Math.min(0.85, editorShadeOpacity)).toFixed(3)})` }}>
          {bruteCompileResult && !bruteCompileResult.success && (
            <div style={{
              position: 'absolute', top: 8, right: 8, zIndex: 10, maxWidth: 320,
              padding: '8px 10px',
              background: 'rgba(255,159,10,0.07)',
              border: '1px solid rgba(255,159,10,0.25)',
              borderRadius: 8,
              color: '#ff9f0a',
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {bruteCompileResult.stderr.slice(0, 200)}
            </div>
          )}
          <MonacoEditor
            height="100%"
            language="cpp"
            value={bruteCode}
            onChange={v => onBruteChange(v ?? '')}
            beforeMount={installCpStudioMonacoTheme}
            theme={CP_STUDIO_GLASS_THEME}
            options={{...MONACO_OPTS,...editorFontOptions}}
            onMount={(editor, monaco) => { editorRef.current=editor; monacoRef.current=monaco; editor.updateOptions(editorFontOptions); monaco.editor.remeasureFonts(); editor.layout(); requestAnimationFrame(()=>{monaco.editor.remeasureFonts();editor.layout();editor.render(true)}) }}
          />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Results list */}
          <div style={{
            width: 180,
            flexShrink: 0,
            borderRight: '1px solid rgba(255,255,255,0.06)',
            overflowY: 'auto',
          }}>
            {results.length === 0 ? (
              <div style={{ padding: 16, color: '#48484a', fontSize: 12, textAlign: 'center' }}>
                No results yet
              </div>
            ) : results.map((r, i) => (
              <div
                key={i}
                onClick={() => setSelected(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  background: selected === i ? 'rgba(10,132,255,0.1)' : 'transparent',
                  borderLeft: `2px solid ${selected === i ? '#0a84ff' : 'transparent'}`,
                }}
              >
                <StatusBadge verdict={r.verdict} compact showLabel={false} />
                <span style={{ flex: 1, fontSize: 11, color: selected === i ? '#e8e8ed' : '#98989d', fontFamily: 'JetBrains Mono, monospace' }}>
                  #{r.index} s={r.seed}
                </span>
                <span style={{ fontSize: 10, color: '#48484a', fontFamily: 'JetBrains Mono, monospace' }}>
                  {r.time_ms}ms
                </span>
              </div>
            ))}
            {running && (
              <div style={{ padding: '8px 10px', color: '#0a84ff', fontSize: 11, animation: 'pulse 1s infinite' }}>
                <LoaderCircle size={12} className="spin-icon" /> Running iteration {results.length + 1}…
              </div>
            )}
          </div>

          {/* Detail */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {selResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StatusBadge verdict={selResult.verdict} />
                  <span style={{ color: '#636366', fontSize: 12, flex:1 }}>
                    Iteration #{selResult.index} · Seed {selResult.seed} · {selResult.time_ms}ms · {(selResult.memory_kb/1024).toFixed(1)}MB
                  </span>
                  {selResult.verdict !== 'AC' && <button onClick={()=>onAddToTests(selResult.input)} style={btnStyle('#30d158',false)}><Plus size={12} /> Add to Test Cases</button>}
                </div>

                <PreBlock label="Input" content={selResult.input} />

                {selResult.verdict === 'WA' ? (
                  <div>
                    <SLabel>Output Diff</SLabel>
                    <OutputDiff expected={selResult.brute_output} actual={selResult.solution_output} />
                  </div>
                ) : (
                  <>
                    <PreBlock label="Solution Output" content={selResult.solution_output} color="#0a84ff" />
                    {selResult.brute_output && (
                      <PreBlock label="Brute Output" content={selResult.brute_output} color="#30d158" />
                    )}
                  </>
                )}
              </div>
            ) : (
              <div style={{ color: '#48484a', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                {results.length === 0
                  ? 'Run stress test to see results'
                  : 'Select an iteration to inspect'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PreBlock({ label, content, color }: { label: string; content: string; color?: string }) {
  return (
    <div>
      <SLabel color={color}>{label}</SLabel>
      <pre style={{
        margin: 0,
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${color ? color + '33' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 7,
        color: color ?? '#e8e8ed',
        fontSize: 12,
        fontFamily: 'JetBrains Mono, monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        maxHeight: 120,
        overflowY: 'auto',
      }}>
        {content || '(empty)'}
      </pre>
    </div>
  )
}

function SLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      color: color ?? '#636366',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      marginBottom: 4,
    }}>
      {children}
    </div>
  )
}

const MONACO_OPTS = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'off' as const,
  tabSize: 4,
  padding: { top: 12, bottom: 12 },
  overviewRulerBorder: false,
  renderLineHighlight: 'gutter' as const,
  cursorBlinking: 'smooth' as const,
  smoothScrolling: true,
  mouseWheelZoom: false,
  automaticLayout: true,
}

const numInputStyle = (w: number): React.CSSProperties => ({
  width: w,
  padding: '2px 6px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 5,
  color: '#e8e8ed',
  fontSize: 12,
  fontFamily: 'JetBrains Mono, monospace',
  textAlign: 'right',
  outline: 'none',
})

function btnStyle(color: string, disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 10px',
    background: `${color}1a`,
    border: `1px solid ${color}33`,
    borderRadius: 6,
    color,
    fontSize: 11,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    whiteSpace: 'nowrap',
    fontFamily: 'Inter, sans-serif',
  }
}
