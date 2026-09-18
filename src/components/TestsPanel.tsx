import { ClipboardList, Copy, Play, Plus, RotateCcw, Trash2, type LucideIcon } from 'lucide-react'
import type { UITestCase } from '../types'
import StatusBadge, { VERDICT_CFG } from './StatusBadge'
import OutputDiff from './OutputDiff'

interface Props {
  testcases: UITestCase[]
  selected: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onClearResults: () => void
  onUpdate: (id: string, patch: Partial<UITestCase>) => void
  onRunOne: (id: string) => void
  onRunAll: () => void
  running: boolean
  timeLimitMs: number
  memLimitMb: number
  nativeReady: boolean
}

export default function TestsPanel({
  testcases, selected, onSelect, onAdd, onRemove, onDuplicate, onClearResults, onUpdate, onRunOne, onRunAll, running, timeLimitMs, memLimitMb, nativeReady
}: Props) {
  const tc = testcases.find(t => t.id === selected)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', minWidth: 0 }}>
      {/* Left list */}
      <div style={{
        width: 'clamp(118px, 28%, 168px)',
        minWidth: 118,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(12,12,14,0.6)',
      }}>
        <div style={{
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ color: '#636366', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Cases ({testcases.length})
          </span>
          <div style={{display:'flex',gap:4}}><IconBtn onClick={onClearResults} title="Clear results" icon={RotateCcw} color="#98989d" /><IconBtn onClick={onAdd} title="Add" icon={Plus} color="#0a84ff" /></div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {testcases.map(tc => (
            <div
              key={tc.id}
              onClick={() => onSelect(tc.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                cursor: 'pointer',
                background: selected === tc.id ? 'rgba(10,132,255,0.1)' : 'transparent',
                borderLeft: `2px solid ${selected === tc.id ? '#0a84ff' : 'transparent'}`,
              }}
            >
              <StatusBadge verdict={tc.verdict ?? 'idle'} compact showLabel={false} />
              <span style={{
                flex: 1,
                color: selected === tc.id ? '#e8e8ed' : '#98989d',
                fontSize: 12,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {tc.name}
              </span>
            </div>
          ))}
        </div>
        <div style={{ padding: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={onAdd}
            style={{
              width: '100%',
              padding: '5px',
              background: 'none',
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 6,
              color: '#48484a',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <Plus size={12} /> Add Case
          </button>
        </div>
      </div>

      {/* Right editor */}
      {tc ? (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* TC header: wraps instead of clipping Run/Duplicate/Delete on narrow widths */}
          <div style={{
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            <input
              value={tc.name}
              onChange={e => onUpdate(tc.id, { name: e.target.value })}
              style={{
                flex: '1 1 150px',
                minWidth: 90,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#e8e8ed',
                fontSize: 13,
                fontWeight: 500,
              }}
            />
            <div style={{display:'flex',alignItems:'center',gap:6,flex:'0 1 auto',minWidth:0,flexWrap:'wrap'}}>
              {tc.verdict && <StatusBadge verdict={tc.verdict} />}
              {tc.execution_time_ms !== undefined && (
                <MetricPill
                  value={`${tc.execution_time_ms}ms`}
                  exceeded={tc.execution_time_ms > timeLimitMs}
                  color={tc.execution_time_ms > timeLimitMs ? '#ff9f0a' : '#30d158'}
                />
              )}
              {tc.memory_kb !== undefined && tc.memory_kb > 0 && (
                <MetricPill
                  value={`${(tc.memory_kb / 1024).toFixed(1)}MB`}
                  exceeded={tc.memory_kb > memLimitMb * 1024}
                  color={tc.memory_kb > memLimitMb * 1024 ? '#bf5af2' : '#30d158'}
                />
              )}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5,marginLeft:'auto',flexShrink:0}}>
              <button
                onClick={() => onRunOne(tc.id)}
                disabled={running || !nativeReady}
                style={{
                  padding: '3px 10px',
                  background: 'rgba(10,132,255,0.15)',
                  border: '1px solid rgba(10,132,255,0.3)',
                  borderRadius: 6,
                  color: '#0a84ff',
                  fontSize: 11,
                  cursor: running || !nativeReady ? 'not-allowed' : 'pointer',
                  opacity: running || !nativeReady ? 0.5 : 1,
                  display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap'
                }}
              >
                <Play size={12} /> Run
              </button>
              <IconBtn onClick={() => onDuplicate(tc.id)} icon={Copy} color="#98989d" title="Duplicate" />
              <IconBtn onClick={() => onRemove(tc.id)} icon={Trash2} color="#ff453a" title="Remove" />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <IOArea label="Input" value={tc.input} onChange={v => onUpdate(tc.id, { input: v })} editable />
            <IOArea label="Expected Output" value={tc.expected_output} onChange={v => onUpdate(tc.id, { expected_output: v })} editable />

            {tc.actual_output !== undefined && tc.verdict && !['idle', 'running'].includes(tc.verdict) && (
              <>
                <IOArea
                  label="Actual Output"
                  value={tc.actual_output || '(no output)'}
                  editable={false}
                  accent={VERDICT_CFG[tc.verdict]?.color}
                />
                {tc.verdict === 'WA' && tc.expected_output && tc.actual_output && (
                  <div>
                    <SectionLabel>Diff</SectionLabel>
                    <OutputDiff expected={tc.expected_output} actual={tc.actual_output} />
                  </div>
                )}
                {tc.verdict === 'RE' && tc.stderr && (
                  <div>
                    <SectionLabel>Stderr</SectionLabel>
                    <pre style={{
                      margin: 0,
                      padding: '8px 10px',
                      background: 'rgba(255,69,58,0.07)',
                      border: '1px solid rgba(255,69,58,0.2)',
                      borderRadius: 7,
                      color: '#ff453a',
                      fontSize: 12,
                      fontFamily: 'JetBrains Mono, monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}>
                      {tc.stderr}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a3a3c', flexDirection: 'column', gap: 8 }}>
          <ClipboardList size={28} />
          <span style={{ fontSize: 13 }}>Select a test case</span>
          <button onClick={onAdd} style={{ marginTop: 4, padding: '5px 14px', background: 'rgba(10,132,255,0.15)', border: '1px solid rgba(10,132,255,0.3)', borderRadius: 6, color: '#0a84ff', fontSize: 12, cursor: 'pointer' }}>
            <Plus size={12} /> Add Case
          </button>
        </div>
      )}
    </div>
  )
}

function IOArea({ label, value, onChange, editable, accent }: {
  label: string; value: string; onChange?: (v: string) => void; editable: boolean; accent?: string
}) {
  return (
    <div>
      <SectionLabel color={accent}>{label}</SectionLabel>
      <textarea
        value={value}
        onChange={e => onChange?.(e.target.value)}
        readOnly={!editable}
        placeholder={editable ? 'Enter here…' : ''}
        style={{
          width: '100%',
          minHeight: 72,
          padding: '8px 10px',
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${accent ? accent + '33' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 7,
          color: accent ?? '#e8e8ed',
          fontSize: 12,
          fontFamily: 'JetBrains Mono, monospace',
          lineHeight: 1.6,
          resize: 'vertical',
          outline: 'none',
        }}
        spellCheck={false}
      />
    </div>
  )
}

function SectionLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ color: color ?? '#636366', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>
      {children}
    </div>
  )
}

function MetricPill({ value, exceeded, color }: { value: string; exceeded: boolean; color: string }) {
  return (
    <span style={{
      padding: '1px 7px',
      background: exceeded ? `${color}1a` : 'rgba(255,255,255,0.05)',
      border: `1px solid ${exceeded ? color + '44' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 5,
      color: exceeded ? color : '#636366',
      fontSize: 11,
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      {value}
    </span>
  )
}

function IconBtn({ onClick, icon: Icon, color, title }: { onClick: () => void; icon: LucideIcon; color: string; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 22, height: 22,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}1a`,
        border: `1px solid ${color}33`,
        borderRadius: 5,
        color,
        fontSize: 14,
        cursor: 'pointer',
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      <Icon size={13} />
    </button>
  )
}
