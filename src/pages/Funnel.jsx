import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { OPP_STAGES, thermoForStage, fmtMoney, fmtMoneyShort, num, inRange, monthRange, yearRange, ytdRange, fmtRange } from '../lib/utils.js'
import { Topbar, Page, Card } from '../components/ui.jsx'
import { toast } from '../components/feedback.jsx'
import { useAuth } from '../lib/auth.jsx'

export default function Funnel() {
  const { data, updateItem } = useStore()
  const { user, isAdmin } = useAuth()
  const [dragId, setDragId] = useState(null)
  const [overCol, setOverCol] = useState(null)

  const now = new Date()
  const curY = now.getFullYear(), curM = now.getMonth() + 1
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const setRange = ([d, h]) => { setDesde(d); setHasta(h) }
  const enRango = o => (!desde && !hasta) || inRange(o.fecha, desde || null, hasta || null)
  const presets = [
    ['Todas', ['', '']],
    ['Este mes', monthRange(curY, curM)],
    ['Mes pasado', monthRange(new Date(curY, curM - 2, 1).getFullYear(), new Date(curY, curM - 2, 1).getMonth() + 1)],
    ['YTD', ytdRange(curY)],
    ['Este año', yearRange(curY)],
    ['Año pasado', yearRange(curY - 1)],
  ]

  const allOpps = data.oportunidades || []
  const abiertas = allOpps.filter(o => o.estado === 'Abierta' && (isAdmin || o.owner === user.nombre) && enRango(o))
  const counts = OPP_STAGES.map((_, i) => abiertas.filter(o => +(o.stage || 0) === i).length)
  const valores = OPP_STAGES.map((_, i) =>
    abiertas.filter(o => +(o.stage || 0) === i).reduce((a, o) => a + num(o.valor), 0))
  const maxCount = Math.max(1, ...counts)

  function onDrop(stageIdx) {
    if (dragId === null) return
    const op = abiertas.find(o => o.id === dragId)
    if (op && +op.stage !== stageIdx) {
      updateItem('oportunidades', dragId, { stage: stageIdx })
      if (op.contactoId) updateItem('leads', op.contactoId, { thermo: thermoForStage(stageIdx) })
      toast(`${op.contacto} → ${OPP_STAGES[stageIdx]}`, 'info')
    }
    setDragId(null); setOverCol(null)
  }

  return (
    <>
      <Topbar title="Funnel de ventas" sub={`${abiertas.length} abiertas${(desde || hasta) ? ' · ' + fmtRange(desde || null, hasta || null) : ''} · arrastra para cambiar de etapa`} />
      <Page>
        <Card className="mb-16">
          <div className="row gap-12 wrap" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="field-label">Rango de fechas (creación)</div>
              <div className="row gap-6">
                <input className="input" type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 150 }} />
                <span className="text-3">→</span>
                <input className="input" type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 150 }} />
              </div>
            </div>
            <div className="row gap-6 wrap">
              {presets.map(([label, r]) => (
                <button key={label} className={`chip${desde === r[0] && hasta === r[1] ? ' on' : ''}`} onClick={() => setRange(r)}>{label}</button>
              ))}
            </div>
          </div>
        </Card>
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
          {OPP_STAGES.map((stage, i) => {
            const ops = abiertas.filter(o => +(o.stage || 0) === i)
            const conv = i > 0 && counts[i - 1] > 0 ? Math.round((counts[i] / counts[i - 1]) * 100) : null
            return (
              <div
                key={stage}
                className={`dnd-col${overCol === i ? ' over' : ''}`}
                style={{ minWidth: 224, flex: 1, display: 'flex', flexDirection: 'column', padding: 4 }}
                onDragOver={e => { e.preventDefault(); setOverCol(i) }}
                onDragLeave={e => { if (e.currentTarget === e.target) setOverCol(null) }}
                onDrop={() => onDrop(i)}
              >
                <div className="card" style={{ padding: 14, marginBottom: 10 }}>
                  <div className="row between">
                    <span className="overline">{stage}</span>
                    {conv !== null && <span className="badge cyan">{conv}%</span>}
                  </div>
                  <div className="kpi-value" style={{ fontSize: 30, marginTop: 6 }}>{counts[i]}</div>
                  <div className="kpi-sub">{fmtMoneyShort(valores[i])} en pipeline</div>
                  <div className="progress mt-8"><span style={{ width: `${(counts[i] / maxCount) * 100}%` }} /></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 60 }}>
                  {ops.map(o => (
                    <div
                      key={o.id}
                      className={`card dnd-card${dragId === o.id ? ' dragging' : ''}`}
                      style={{ padding: 11 }}
                      draggable
                      onDragStart={() => setDragId(o.id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null) }}
                    >
                      <div className="cell-strong" style={{ fontSize: 13 }}>{o.contacto}</div>
                      <div className="text-3" style={{ fontSize: 11.5 }}>{o.vehiculoInteres || 'Vehículo por definir'}</div>
                      {num(o.valor) > 0 && <div className="cell-money t-cyan mt-8" style={{ fontSize: 13 }}>{fmtMoney(o.valor)}</div>}
                    </div>
                  ))}
                  {!ops.length && <div className="text-3" style={{ fontSize: 11.5, padding: '10px 2px', textAlign: 'center' }}>Suelta aquí</div>}
                </div>
              </div>
            )
          })}
        </div>
      </Page>
    </>
  )
}
