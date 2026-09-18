import MonacoEditor from '@monaco-editor/react'
import { CP_STUDIO_GLASS_THEME, installCpStudioMonacoTheme } from '../editor/monacoTheme'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Hammer, LoaderCircle, Plus, RotateCcw, Sparkles, XCircle } from 'lucide-react'
import { DEFAULT_GUI_CONFIG, generateGuiInput, type GuiGeneratorConfig, type GuiKind } from '../generator/guiGenerator'
import type { CompileResult } from '../types'
import type { MonacoFontOptions } from '../editor/editorAppearance'

interface Props {
  code: string
  onChange: (v: string) => void
  onCompile: () => Promise<CompileResult>
  onGenerate: (seed: number) => Promise<string>
  onAddToTests: (input: string) => void
  compileResult?: CompileResult
  nativeReady: boolean
  editorFontOptions: MonacoFontOptions
  editorShadeOpacity: number
}

export const DEFAULT_GENERATOR_CODE = `#include <bits/stdc++.h>
using namespace std;

// Usage: ./generator <seed>
// Prints a random test case to stdout

mt19937 rng;

int randInt(int lo, int hi) {
    return uniform_int_distribution<int>(lo, hi)(rng);
}

int main(int argc, char* argv[]) {
    int seed = argc > 1 ? atoi(argv[1]) : 42;
    rng.seed(seed);

    int n = randInt(1, 10);
    cout << n << "\\n";
    for (int i = 0; i < n; i++) {
        cout << randInt(1, 1000);
        if (i < n - 1) cout << " ";
    }
    cout << "\\n";

    return 0;
}
`

export default function GeneratorPanel({ code, onChange, onCompile, onGenerate, onAddToTests, compileResult, nativeReady, editorFontOptions, editorShadeOpacity }: Props) {
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<any>(null)
  const [mode, setMode] = useState<'gui'|'cpp'>('gui')
  const [gui, setGui] = useState<GuiGeneratorConfig>(DEFAULT_GUI_CONFIG)
  const [count, setCount] = useState(1)
  const [seed, setSeed] = useState(42)
  const [generatedInput, setGeneratedInput] = useState('')
  const [compiling, setCompiling] = useState(false)
  const [generating, setGenerating] = useState(false)

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
    try {
      await onCompile()
    } finally {
      setCompiling(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      if (mode === 'gui') {
        const first = generateGuiInput(gui, seed)
        setGeneratedInput(first)
        if (count > 1) for (let i=0;i<count;i++) onAddToTests(generateGuiInput(gui, seed+i))
      } else {
        // onGenerate compiles the current generator.cpp when needed and uses
        // the returned binary path directly, avoiding stale React state.
        setGeneratedInput(await onGenerate(seed))
      }
    } finally { setGenerating(false) }
  }

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
        <button onClick={()=>setMode('gui')} style={btnStyle(mode==='gui'?'#0a84ff':'#636366',false)}>GUI Generator</button><button onClick={()=>setMode('cpp')} style={btnStyle(mode==='cpp'?'#0a84ff':'#636366',false)}>generator.cpp</button>

        {mode === 'cpp' && <button
          onClick={handleCompile}
          disabled={compiling || !nativeReady}
          style={btnStyle('#ff9f0a', compiling)}
        >
          {compiling ? <><LoaderCircle size={13} className="spin-icon" /> Compiling…</> : <><Hammer size={13} /> Compile</>}
        </button>}

        {mode === 'cpp' && compileResult && (
          <span style={{ fontSize: 11, color: compileResult.success ? '#30d158' : '#ff453a' }}>
            {compileResult.success ? <><CheckCircle2 size={12} /> Ready</> : <><XCircle size={12} /> Error</>}
          </span>
        )}

        <div style={{ flex: 1 }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#98989d', fontSize: 11 }}>
          Seed
          <input
            type="number"
            value={seed}
            onChange={e => setSeed(Number(e.target.value))}
            style={{
              width: 64,
              padding: '2px 6px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 5,
              color: '#e8e8ed',
              fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace',
              textAlign: 'right',
              outline: 'none',
            }}
          />
        </label>

        <label style={{ display:'flex',alignItems:'center',gap:6,color:'#98989d',fontSize:11 }}>Tests<input type="number" min={1} max={1000} value={count} onChange={e=>setCount(Math.max(1,Number(e.target.value)))} style={{width:58,padding:'2px 6px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:5,color:'#e8e8ed',fontSize:12}} /></label>

        <button
          onClick={handleGenerate}
          disabled={generating || compiling || (mode === 'cpp' && !nativeReady)}
          style={btnStyle('#0a84ff', generating || compiling)}
        >
          {generating ? <><LoaderCircle size={13} className="spin-icon" /> Generating…</> : <><Sparkles size={13} /> Generate</>}
        </button>
      </div>

      {/* Split: editor left, preview right */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Generator editor/config */}
        <div style={{ flex: 1, overflow: 'auto', minWidth: 0, background: mode === 'cpp' ? `rgba(7,7,10,${Math.max(0, Math.min(0.85, editorShadeOpacity)).toFixed(3)})` : undefined }}>
          {mode === 'cpp' ? <MonacoEditor height="100%" language="cpp" value={code} onChange={v => onChange(v ?? '')} beforeMount={installCpStudioMonacoTheme}
            theme={CP_STUDIO_GLASS_THEME} options={{...MONACO_OPTS,...editorFontOptions}}
            onMount={(editor, monaco) => { editorRef.current=editor; monacoRef.current=monaco; editor.updateOptions(editorFontOptions); monaco.editor.remeasureFonts(); editor.layout(); requestAnimationFrame(()=>{monaco.editor.remeasureFonts();editor.layout();editor.render(true)}) }} /> :
          <div style={{padding:14,display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <Field label="Type"><select value={gui.kind} onChange={e=>setGui({...gui,kind:e.target.value as GuiKind})} style={fieldStyle}>{['integer','array','string','binary','permutation','matrix','graph','tree'].map(x=><option key={x} value={x}>{x}</option>)}</select></Field>
            <Field label="Pattern"><select value={gui.pattern} onChange={e=>setGui({...gui,pattern:e.target.value})} style={fieldStyle}>{['random','minimum','maximum','increasing','decreasing','all-same'].map(x=><option key={x}>{x}</option>)}</select></Field>
            <Field label="N / Length"><input type="number" value={gui.n} onChange={e=>setGui({...gui,n:Number(e.target.value),length:Number(e.target.value)})} style={fieldStyle}/></Field>
            <Field label="M"><input type="number" value={gui.m} onChange={e=>setGui({...gui,m:Number(e.target.value)})} style={fieldStyle}/></Field>
            <Field label="Min"><input type="number" value={gui.min} onChange={e=>setGui({...gui,min:Number(e.target.value)})} style={fieldStyle}/></Field>
            <Field label="Max"><input type="number" value={gui.max} onChange={e=>setGui({...gui,max:Number(e.target.value)})} style={fieldStyle}/></Field>
            <Field label="Rows"><input type="number" value={gui.rows} onChange={e=>setGui({...gui,rows:Number(e.target.value)})} style={fieldStyle}/></Field>
            <Field label="Cols"><input type="number" value={gui.cols} onChange={e=>setGui({...gui,cols:Number(e.target.value)})} style={fieldStyle}/></Field>
            <Field label="Weighted"><input type="checkbox" checked={gui.weighted} onChange={e=>setGui({...gui,weighted:e.target.checked})}/></Field>
            <Field label="Directed"><input type="checkbox" checked={gui.directed} onChange={e=>setGui({...gui,directed:e.target.checked})}/></Field>
            <Field label="Connected"><input type="checkbox" checked={gui.connected} onChange={e=>setGui({...gui,connected:e.target.checked})}/></Field>
            <Field label="Charset"><input value={gui.charset} onChange={e=>setGui({...gui,charset:e.target.value})} style={fieldStyle}/></Field>
          </div>}
        </div>

        {/* Preview panel */}
        <div style={{
          width: 240,
          flexShrink: 0,
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(10,10,12,0.28)',
        }}>
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            color: '#636366',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Generated Input
          </div>

          {compileResult && !compileResult.success && (
            <div style={{ padding: 12 }}>
              <pre style={{
                margin: 0,
                padding: '8px 10px',
                background: 'rgba(255,159,10,0.07)',
                border: '1px solid rgba(255,159,10,0.2)',
                borderRadius: 7,
                color: '#ff9f0a',
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {compileResult.stderr.slice(0, 300)}
              </pre>
            </div>
          )}

          <pre style={{
            flex: 1,
            margin: 0,
            padding: '10px 12px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            color: '#e8e8ed',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {generatedInput || <span style={{ color: '#3a3a3c' }}>Click Generate to preview…</span>}
          </pre>

          {generatedInput && (
            <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                onClick={async () => { const next=seed+1; setSeed(next); if(mode==='gui') setGeneratedInput(generateGuiInput(gui,next)); else setGeneratedInput(await onGenerate(next)) }}
                style={btnStyle('#0a84ff', generating)}
              >
                <RotateCcw size={12} /> New Seed ({seed + 1})
              </button>
              <button
                onClick={() => onAddToTests(generatedInput)}
                style={{ ...btnStyle('#30d158', false), width: '100%' }}
              >
                <Plus size={12} /> Add to Tests
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const MONACO_OPTS = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'off' as const,
  tabSize: 4,
  insertSpaces: true,
  renderWhitespace: 'none' as const,
  padding: { top: 12, bottom: 12 },
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  renderLineHighlight: 'gutter' as const,
  cursorBlinking: 'smooth' as const,
  smoothScrolling: true,
  mouseWheelZoom: false,
  automaticLayout: true,
}

const fieldStyle: React.CSSProperties={width:'100%',padding:'5px 7px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,color:'#e8e8ed',fontSize:12,outline:'none'}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label style={{color:'#636366',fontSize:10,textTransform:'uppercase',letterSpacing:'0.06em',display:'flex',flexDirection:'column',gap:4}}>{label}{children}</label>}

function btnStyle(color: string, disabled: boolean): React.CSSProperties {
  return {
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
