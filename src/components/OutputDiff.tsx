interface Props {
  expected: string
  actual: string
}

export default function OutputDiff({ expected, actual }: Props) {
  const expLines = expected.split('\n')
  const actLines = actual.split('\n')
  const len = Math.max(expLines.length, actLines.length)

  return (
    <div style={{
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12,
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ padding: '5px 10px', color: '#30d158', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          EXPECTED
        </div>
        <div style={{ padding: '5px 10px', color: '#ff453a', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em' }}>
          ACTUAL
        </div>
      </div>
      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        {Array.from({ length: len }, (_, i) => {
          const e = expLines[i] ?? ''
          const a = actLines[i] ?? ''
          const diff = e !== a
          return (
            <div
              key={i}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}
            >
              <div style={{
                padding: '2px 10px',
                background: diff ? 'rgba(48,209,88,0.07)' : 'transparent',
                borderRight: '1px solid rgba(255,255,255,0.04)',
                color: diff ? '#30d158' : '#636366',
                whiteSpace: 'pre',
              }}>
                {e !== '' ? e : <span style={{ color: '#3a3a3c' }}>∅</span>}
              </div>
              <div style={{
                padding: '2px 10px',
                background: diff ? 'rgba(255,69,58,0.07)' : 'transparent',
                color: diff ? '#ff453a' : '#636366',
                whiteSpace: 'pre',
              }}>
                {a !== '' ? a : <span style={{ color: '#3a3a3c' }}>∅</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
