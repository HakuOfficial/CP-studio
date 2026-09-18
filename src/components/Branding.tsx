import { LoaderCircle } from 'lucide-react'
import iconUrl from '../assets/branding/cpstudio-icon.svg'
import wordmarkUrl from '../assets/branding/cpstudio-wordmark.svg'

export function CPStudioBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 7 : 10,
        minWidth: 0,
        pointerEvents: 'none',
      }}
    >
      <img
        src={iconUrl}
        alt=""
        draggable={false}
        style={{
          width: compact ? 22 : 30,
          height: compact ? 22 : 30,
          borderRadius: compact ? 6 : 8,
          flexShrink: 0,
          display: 'block',
        }}
      />
      {!compact && (
        <div style={{ minWidth: 0, lineHeight: 1.05 }}>
          <div style={{ color: '#e8e8ed', fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
            CP Studio
          </div>
          <div style={{ color: '#636366', fontSize: 8, fontWeight: 600, letterSpacing: '0.13em', whiteSpace: 'nowrap', marginTop: 3 }}>
            COMPETITIVE PROGRAMMING IDE
          </div>
        </div>
      )}
    </div>
  )
}

export function EditorLoadingScreen({ message = 'Loading code editor…' }: { message?: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 42%, rgba(10,132,255,0.10), transparent 32%), rgba(8,8,10,0.72)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <div style={{ width: 'min(620px, 82vw)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 28 }}>
        <img
          src={wordmarkUrl}
          alt="CP Studio — Competitive Programming IDE"
          draggable={false}
          style={{ width: '100%', maxWidth: 520, height: 'auto', display: 'block', filter: 'drop-shadow(0 18px 40px rgba(0,0,0,.40))' }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            color: '#98989d',
            fontSize: 12,
            padding: '8px 13px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.035)',
            backdropFilter: 'blur(18px)',
          }}
        >
          <LoaderCircle size={14} className="spin-icon" color="#0a84ff" />
          {message}
        </div>
      </div>
    </div>
  )
}

export function WelcomeBrand() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: 24, textAlign: 'center' }}>
      <img
        src={wordmarkUrl}
        alt="CP Studio — Competitive Programming IDE"
        draggable={false}
        style={{ width: 'min(620px, 80vw)', maxWidth: '100%', height: 'auto', display: 'block' }}
      />
      <div style={{ color: '#636366', fontSize: 12, maxWidth: 520, lineHeight: 1.7 }}>
        Fast coding, compiling, testcase judging, snippets, generators, and stress testing in one focused desktop IDE.
      </div>
    </div>
  )
}
