import { Circle, CircleCheck, CircleX, Clock3, Hammer, LoaderCircle, MemoryStick, Zap, type LucideIcon } from 'lucide-react'
import type { Verdict } from '../types'

export const VERDICT_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: LucideIcon }> = {
  AC:      { label: 'Accepted',              color: '#30d158', bg: 'rgba(48,209,88,0.12)',   border: 'rgba(48,209,88,0.25)',   icon: CircleCheck },
  WA:      { label: 'Wrong Answer',          color: '#ff453a', bg: 'rgba(255,69,58,0.12)',   border: 'rgba(255,69,58,0.25)',   icon: CircleX },
  TLE:     { label: 'Time Limit Exceeded',   color: '#ff9f0a', bg: 'rgba(255,159,10,0.12)',  border: 'rgba(255,159,10,0.25)',  icon: Clock3 },
  MLE:     { label: 'Memory Limit Exceeded', color: '#bf5af2', bg: 'rgba(191,90,242,0.12)',  border: 'rgba(191,90,242,0.25)',  icon: MemoryStick },
  RE:      { label: 'Runtime Error',         color: '#ff453a', bg: 'rgba(255,69,58,0.12)',   border: 'rgba(255,69,58,0.25)',   icon: Zap },
  CE:      { label: 'Compile Error',         color: '#ff9f0a', bg: 'rgba(255,159,10,0.12)',  border: 'rgba(255,159,10,0.25)',  icon: Hammer },
  idle:    { label: 'Not Run',               color: '#636366', bg: 'rgba(99,99,102,0.1)',    border: 'rgba(99,99,102,0.2)',    icon: Circle },
  running: { label: 'Running…',              color: '#0a84ff', bg: 'rgba(10,132,255,0.12)',  border: 'rgba(10,132,255,0.25)',  icon: LoaderCircle },
}

interface Props {
  verdict?: Verdict | 'idle' | 'running'
  compact?: boolean
  showLabel?: boolean
}

export default function StatusBadge({ verdict, compact, showLabel = true }: Props) {
  const key = verdict ?? 'idle'
  const cfg = VERDICT_CFG[key] ?? VERDICT_CFG.idle
  const Icon = cfg.icon
  const spinning = key === 'running'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 3 : 4,
        padding: compact ? '1px 5px' : '2px 8px',
        borderRadius: compact ? 4 : 6,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        fontSize: compact ? 10 : 11,
        fontWeight: 600,
        fontFamily: 'JetBrains Mono, monospace',
        letterSpacing: '0.03em',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <Icon size={compact ? 10 : 12} className={spinning ? 'spin-icon' : undefined} />
      {showLabel && !compact && cfg.label}
    </span>
  )
}
