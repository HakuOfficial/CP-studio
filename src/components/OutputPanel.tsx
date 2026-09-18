import { Hammer } from 'lucide-react'
import type { UITestCase, UIVerdict } from '../types'
import type { CompilerDiagnostic } from '../tauri-bridge'
import StatusBadge, { VERDICT_CFG } from './StatusBadge'
import OutputDiff from './OutputDiff'

interface Props {
  testcases: UITestCase[]
  timeLimitMs: number
  memLimitMb: number
  compileError?: string
  diagnostics?: CompilerDiagnostic[]
  onDiagnosticClick?: (diagnostic: CompilerDiagnostic) => void
}

export default function OutputPanel({ testcases, timeLimitMs, memLimitMb, compileError, diagnostics = [], onDiagnosticClick }: Props) {
  const idleOrRunning: UIVerdict[] = ['running']
  const ran = testcases.filter(tc => tc.verdict && !idleOrRunning.includes(tc.verdict as UIVerdict))
  const ac = ran.filter(tc => tc.verdict === 'AC').length
  const allRunning = testcases.some(tc => tc.verdict === 'running')

  const counts: Record<string, number> = {}
  for (const tc of ran) {
    counts[tc.verdict!] = (counts[tc.verdict!] ?? 0) + 1
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Summary bar */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        {compileError ? (
          <div>
            <div style={{ color: '#ff9f0a', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              <Hammer size={14} /> Compile Error
            </div>
            <pre style={{
              margin: 0,
              padding: '8px 10px',
              background: 'rgba(255,159,10,0.07)',
              border: '1px solid rgba(255,159,10,0.2)',
              borderRadius: 7,
              color: '#ff9f0a',
              fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxHeight: 120,
              overflow: 'auto',
            }}>
              {compileError}
            </pre>
            {diagnostics.length > 0 && (
              <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:4,maxHeight:110,overflowY:'auto'}}>
                {diagnostics.map((d, i) => (
                  <button key={`${d.file}:${d.line}:${d.column}:${i}`} onClick={() => onDiagnosticClick?.(d)} style={{textAlign:'left',padding:'5px 8px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:6,color:'#d1d1d6',fontSize:11,fontFamily:'JetBrains Mono, monospace',cursor:onDiagnosticClick?'pointer':'default'}}>
                    <span style={{color:'#ff9f0a'}}>{d.line}:{d.column}</span> {d.message}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <span style={{
                fontSize: 22,
                fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace',
                color: allRunning ? '#0a84ff'
                  : ran.length === 0 ? '#48484a'
                  : ac === ran.length ? '#30d158'
                  : '#ff9f0a',
              }}>
                {allRunning ? 'Running…' : ran.length === 0 ? 'Not run' : ac === ran.length ? 'Accepted' : 'Judged'}
              </span>
              {ran.length > 0 && (
                <span style={{ color: '#636366', fontSize: 13 }}>
                  {ac} / {ran.length} passed
                </span>
              )}
            </div>
            {Object.entries(counts).length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(counts).map(([v, c]) => {
                  const cfg = VERDICT_CFG[v]
                  return (
                    <span key={v} style={{
                      padding: '2px 8px',
                      background: cfg.bg,
                      border: `1px solid ${cfg.border}`,
                      borderRadius: 5,
                      color: cfg.color,
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}>
                      {c}× {v}
                    </span>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Results list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {testcases.map(tc => (
          <div key={tc.id} style={{
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <StatusBadge verdict={tc.verdict ?? 'idle'} compact />
              <span style={{ color: '#e8e8ed', fontSize: 12, fontWeight: 500, flex: 1 }}>
                {tc.name}
              </span>
              {tc.execution_time_ms !== undefined && (
                <span style={{
                  color: tc.execution_time_ms > timeLimitMs ? '#ff9f0a' : '#636366',
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {tc.execution_time_ms}ms
                </span>
              )}
              {tc.memory_kb !== undefined && tc.memory_kb > 0 && (
                <span style={{
                  color: tc.memory_kb > memLimitMb * 1024 ? '#bf5af2' : '#636366',
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {(tc.memory_kb / 1024).toFixed(1)}MB
                </span>
              )}
            </div>

            {tc.verdict === 'TLE' && (
              <p style={{ margin: 0, fontSize: 11, color: '#ff9f0a' }}>
                {tc.execution_time_ms}ms exceeded {timeLimitMs}ms limit
              </p>
            )}
            {tc.verdict === 'MLE' && (
              <p style={{ margin: 0, fontSize: 11, color: '#bf5af2' }}>
                {tc.memory_kb && (tc.memory_kb / 1024).toFixed(1)}MB exceeded {memLimitMb}MB limit
              </p>
            )}
            {tc.verdict === 'RE' && tc.stderr && (
              <pre style={{
                margin: '4px 0 0',
                padding: '5px 8px',
                background: 'rgba(255,69,58,0.07)',
                border: '1px solid rgba(255,69,58,0.18)',
                borderRadius: 6,
                color: '#ff453a',
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace',
                whiteSpace: 'pre-wrap',
              }}>
                {tc.stderr.slice(0, 200)}
              </pre>
            )}
            {tc.verdict === 'WA' && tc.actual_output !== undefined && (
              <div style={{ marginTop: 6 }}>
                <OutputDiff expected={tc.expected_output} actual={tc.actual_output} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
