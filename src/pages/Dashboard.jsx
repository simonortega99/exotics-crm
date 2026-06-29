import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import {
  fmtMoney, fmtMoneyShort, cumpleInfo, today, num,
  inRange, monthRange, yearRange, ytdRange, shiftYear, prevPeriod, fmtRange,
} from '../lib/utils.js'
import { Topbar, Page, Kpi, Card, Badge } from '../components/ui.jsx'
import { Download } from 'lucide-react'
import { toast } from '../components/feedback.jsx'
import { useAuth } from '../lib/auth.jsx'

const ingresoDe = v => num(v.ganancia) || num(v.comision)
const pctDelta = (c, p) => (p > 0 ? Math.round(((c - p) / p) * 100) : null)

function descargarExcel(filename, html) {
  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function Dashboard() {
  const { data, setField } = useStore()
  const { user, isAdmin } = useAuth()
  const { inventario, meta, metaAnual } = data
  const leads = isAdmin ? data.leads : data.leads.filter(l => l.owner === user.nombre)
  const ventas = isAdmin ? data.ventas : data.ventas.filter(v => v.owner === user.nombre)
  const actividades = isAdmin ? (data.actividades || []) : (data.actividades || []).filter(a => a.owner === user.nombre)
  const oportunidades = isAdmin ? (data.oportunidades || []) : (data.oportunidades || []).filter(o => o.owner === user.nombre)
  const asesores = data.asesores || ['Simón', 'Roberto']

  const now = new Date()
  const curY = now.getFullYear(), curM = now.getMonth() + 1
  const [tab, setTab] = useState('general')
  const [desde, setDesde] = useState(monthRange(curY, curM)[0])
  const [hasta, setHasta] = useState(monthRange(curY, curM)[1])
  const [comp, setComp] = useState('anioant')

  const setRange = ([d, h]) => { setDesde(d); setHasta(h) }
  const presets = [
    ['Este mes', monthRange(curY, curM)],
    ['Mes pasado', monthRange(new Date(curY, curM - 2, 1).getFullYear(), new Date(curY, curM - 2, 1).getMonth() + 1)],
    ['YTD', ytdRange(curY)],
    ['Este año', yearRange(curY)],
    ['Año pasado', yearRange(curY - 1)],
  ]

  const [cDesde, cHasta] = comp === 'anioant' ? shiftYear([desde, hasta], -1) : comp === 'periodoant' ? prevPeriod([desde, hasta]) : [null, null]
  const compLabel = comp === 'anioant' ? 'mismo rango año anterior' : comp === 'periodoant' ? 'periodo anterior' : null

  const ventasP = ventas.filter(v => inRange(v.fecha, desde, hasta))
  const ventasC = cDesde ? ventas.filter(v => inRange(v.fecha, cDesde, cHasta)) : []
  const ingresosP = ventasP.reduce((a, v) => a + ingresoDe(v), 0)
  const ingresosC = ventasC.reduce((a, v) => a + ingresoDe(v), 0)
  const nuevosIngresos = inventario.filter(v => inRange(v.fechaIngreso, desde, hasta)).length

  // Ventas por fuente (del rango)
  const fuentes = {}
  ventasP.forEach(v => { const f = v.fuente || 'Sin fuente'; (fuentes[f] = fuentes[f] || { n: 0, ing: 0 }); fuentes[f].n++; fuentes[f].ing += ingresoDe(v) })
  const fuenteRows = Object.entries(fuentes).sort((a, b) => b[1].n - a[1].n)

  const abiertas = oportunidades.filter(o => o.estado === 'Abierta')
  const invDisponible = inventario.filter(v => v.estado === 'Disponible')

  // Meta: usa las ventas del RANGO seleccionado y compara contra la meta
  // mensual o anual guardada según el tamaño del rango (≤ 1 mes → mensual).
  const rangeDays = (desde && hasta) ? Math.round((new Date(hasta) - new Date(desde)) / 86400000) + 1 : 31
  const metaEsMensual = rangeDays <= 31
  const metaTarget = (metaEsMensual ? meta : metaAnual) || 1
  const pct = Math.min(100, Math.round((ventasP.length / metaTarget) * 100))

  const cumpleProximos = leads.filter(l => { const ci = cumpleInfo(l.cumple); return ci && ci.diff <= 3 })
  const oppsCierre = abiertas.filter(o => +o.stage >= 3)
  const tareasHoy = (actividades || []).filter(a => a.fecha === today() && !a.done && a.tipo !== 'Fidelización')
  const fidelidadHoy = (actividades || []).filter(a => a.tipo === 'Fidelización' && !a.done && a.fecha <= today())
  const sinAlertas = !tareasHoy.length && !cumpleProximos.length && !oppsCierre.length && !fidelidadHoy.length

  const subDelta = (c, p) => comp === 'none' ? fmtRange(desde, hasta) : deltaSub(c, p, compLabel)

  const filasAsesor = asesores.map(nombre => {
    const leadsActivos = leads.filter(l => l.owner === nombre && (l.rol || 'lead') === 'lead').length
    const oppsAbiertas = oportunidades.filter(o => o.owner === nombre && o.estado === 'Abierta').length
    const oppsCreadas = oportunidades.filter(o => o.owner === nombre && inRange(o.fecha, desde, hasta)).length
    const vP = ventas.filter(v => v.owner === nombre && inRange(v.fecha, desde, hasta))
    const cierres = vP.length
    const ingresos = vP.reduce((a, v) => a + ingresoDe(v), 0)
    const vehiculos = inventario.filter(v => v.owner === nombre && v.estado !== 'Vendido').length
    const efectividad = oppsCreadas ? Math.round((cierres / oppsCreadas) * 100) : null
    return { nombre, leadsActivos, oppsAbiertas, oppsCreadas, cierres, ingresos, vehiculos, efectividad }
  })

  function exportar() {
    const f = n => Number(n || 0).toLocaleString('es-CO')
    const general = `
      <h3>Resumen general · ${fmtRange(desde, hasta)}</h3>
      <table border="1"><tr><th>Métrica</th><th>Valor</th><th>${compLabel || ''}</th></tr>
      <tr><td>Oportunidades abiertas</td><td>${abiertas.length}</td><td></td></tr>
      <tr><td>Ventas del rango</td><td>${ventasP.length}</td><td>${ventasC.length}</td></tr>
      <tr><td>Ingresos generados</td><td>${f(ingresosP)}</td><td>${f(ingresosC)}</td></tr>
      <tr><td>Inventario disponible</td><td>${invDisponible.length}</td><td></td></tr>
      <tr><td>Nuevos ingresos a inventario</td><td>${nuevosIngresos}</td><td></td></tr>
      </table>`
    const ases = `
      <h3>Asesores · ${fmtRange(desde, hasta)}</h3>
      <table border="1"><tr><th>Asesor</th><th>Leads activos</th><th>Oport. abiertas</th><th>Oport. creadas</th><th>Cierres</th><th>Ingresos</th><th>Vehículos</th><th>Efectividad %</th></tr>
      ${filasAsesor.map(r => `<tr><td>${r.nombre}</td><td>${r.leadsActivos}</td><td>${r.oppsAbiertas}</td><td>${r.oppsCreadas}</td><td>${r.cierres}</td><td>${f(r.ingresos)}</td><td>${r.vehiculos}</td><td>${r.efectividad ?? '—'}</td></tr>`).join('')}
      </table>`
    const fuente = `
      <h3>Ventas por fuente · ${fmtRange(desde, hasta)}</h3>
      <table border="1"><tr><th>Fuente</th><th>Unidades</th><th>Ingresos</th></tr>
      ${fuenteRows.map(([fu, x]) => `<tr><td>${fu}</td><td>${x.n}</td><td>${f(x.ing)}</td></tr>`).join('')}
      </table>`
    descargarExcel(`Exotics_metricas_${desde}_a_${hasta}.xls`, `<meta charset="utf-8">${general}<br/>${ases}<br/>${fuente}`)
    toast('Métricas exportadas a Excel')
  }

  return (
    <>
      <Topbar title="Dashboard" sub={`Exotics Co. · ${fmtRange(desde, hasta)}`}>
        <button className="btn" onClick={exportar}><Download size={14} /> Exportar Excel</button>
        {isAdmin && (
          <div className="seg">
            <button className={tab === 'general' ? 'on' : ''} onClick={() => setTab('general')}>General</button>
            <button className={tab === 'asesores' ? 'on' : ''} onClick={() => setTab('asesores')}>Asesores</button>
          </div>
        )}
      </Topbar>
      <Page>
        <Card className="mb-16">
          <div className="row gap-12 wrap" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="field-label">Rango de fechas</div>
              <div className="row gap-6">
                <input className="input" type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 150 }} />
                <span className="text-3">→</span>
                <input className="input" type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 150 }} />
              </div>
            </div>
            <div>
              <div className="field-label">Comparar con</div>
              <select className="select" value={comp} onChange={e => setComp(e.target.value)} style={{ width: 230 }}>
                <option value="anioant">Año anterior (mismo rango)</option>
                <option value="periodoant">Periodo anterior (mismo tamaño)</option>
                <option value="none">Sin comparación</option>
              </select>
            </div>
          </div>
          {comp !== 'none' && <div className="text-3" style={{ fontSize: 12, marginTop: 10 }}>Comparando con {fmtRange(cDesde, cHasta)}</div>}
          <div style={{ borderTop: '1px solid var(--line)', margin: '18px 0 0' }} />
          <div className="row gap-8 wrap" style={{ marginTop: 16, alignItems: 'center' }}>
            <span className="overline" style={{ marginRight: 4 }}>Atajos</span>
            {presets.map(([label, r]) => (
              <button key={label} className={`chip${desde === r[0] && hasta === r[1] ? ' on' : ''}`} onClick={() => setRange(r)}>{label}</button>
            ))}
          </div>
        </Card>

        {(tab === 'general' || !isAdmin) ? (
          <>
            <div className="kpi-grid mb-16">
              <Kpi to="/oportunidades" label="Oportunidades abiertas" value={abiertas.length} accent="cyan" sub={`${oppsCierre.length} en cierre`} />
              <Kpi to="/ventas" label="Ventas del rango" value={ventasP.length} accent="green" sub={subDelta(ventasP.length, ventasC.length)} />
              <Kpi to="/ventas" label="Ingresos generados" value={fmtMoneyShort(ingresosP)} valueClass="green" accent="green" sub={subDelta(ingresosP, ingresosC)} />
              <Kpi to="/inventario" label="Inventario disponible" value={invDisponible.length} accent="amber" sub={fmtMoneyShort(invDisponible.reduce((a, v) => a + num(v.precio), 0))} />
              <Kpi to="/inventario" label="Nuevos ingresos" value={nuevosIngresos} accent="ink" sub="carros que entraron" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 16 }}>
              <Card>
                <div className="card-head">
                  <span className="card-title">Meta de ventas · {metaEsMensual ? 'mensual' : 'anual'}</span>
                </div>
                <div className="row between" style={{ alignItems: 'baseline', marginBottom: 10 }}>
                  <span className="kpi-value cyan" style={{ fontSize: 32 }}>{pct}%</span>
                  <span className="text-3" style={{ fontSize: 13 }}>{ventasP.length} de {metaTarget} ventas</span>
                </div>
                <div className="progress"><span style={{ width: `${pct}%` }} /></div>
                {isAdmin && (
                  <div className="row gap-16 mt-16">
                    <div>
                      <div className="field-label">Meta mensual</div>
                      <input className="input" type="number" min="1" value={meta} onChange={e => setField('meta', Math.max(1, +e.target.value || 1))} style={{ width: 80, textAlign: 'center' }} />
                    </div>
                    <div>
                      <div className="field-label">Meta anual</div>
                      <input className="input" type="number" min="1" value={metaAnual} onChange={e => setField('metaAnual', Math.max(1, +e.target.value || 1))} style={{ width: 80, textAlign: 'center' }} />
                    </div>
                  </div>
                )}
                <div className="text-3 mt-16" style={{ fontSize: 11.5 }}>Compara las ventas del rango contra la meta {metaEsMensual ? 'mensual' : 'anual'} (rangos de ≤ 1 mes usan la mensual; mayores, la anual). Las metas quedan guardadas.</div>
              </Card>

              <Card title="Alertas y tareas de hoy">
                {tareasHoy.map(a => <AlertRow key={a.id} tone="cyan"><b>{a.titulo}</b>{a.lead ? ` — ${a.lead}` : ''} <Badge tone="cyan">hoy</Badge></AlertRow>)}
                {oppsCierre.map(o => <AlertRow key={o.id} tone="amber"><b>{o.contacto}</b> — oportunidad en cierre {o.vehiculoInteres ? `(${o.vehiculoInteres})` : ''}</AlertRow>)}
                {cumpleProximos.map(l => { const ci = cumpleInfo(l.cumple); return <AlertRow key={l.id} tone="violet">🎂 <b>{l.nombre}</b> — {ci.diff === 0 ? 'hoy' : ci.diff === 1 ? 'mañana' : `en ${ci.diff}d`}</AlertRow> })}
                {fidelidadHoy.map(a => <AlertRow key={a.id} tone="green"><b>{a.cliente || a.lead}</b> — fidelización: {a.titulo}</AlertRow>)}
                {sinAlertas && <div className="text-3" style={{ fontSize: 13, padding: '8px 0' }}>Todo bajo control. Sin alertas activas.</div>}
              </Card>
            </div>

            <div className="mt-16" style={{ maxWidth: 360 }}>
              <Card title="Ventas por fuente"><MiniPie rows={fuenteRows} /></Card>
            </div>
          </>
        ) : (
          <>
            <div className="section-head"><span className="section-title">Rendimiento por asesor · {fmtRange(desde, hasta)}</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
              {filasAsesor.map(f => {
                const maxC = Math.max(1, ...filasAsesor.map(x => x.cierres))
                return (
                  <Card key={f.nombre}>
                    <div className="row between mb-12">
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>{f.nombre}</span>
                      <Badge tone={f.efectividad === null ? 'gray' : f.efectividad >= 30 ? 'green' : 'amber'}>
                        {f.efectividad === null ? 'sin datos' : `${f.efectividad}% efectividad`}
                      </Badge>
                    </div>
                    <div className="kpi-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Metric label="Leads activos" value={f.leadsActivos} />
                      <Metric label="Oport. abiertas" value={f.oppsAbiertas} />
                      <Metric label="Oport. creadas (rango)" value={f.oppsCreadas} />
                      <Metric label="Cierres (rango)" value={f.cierres} />
                      <Metric label="Ingresos generados" value={fmtMoneyShort(f.ingresos)} tone="t-green" />
                      <Metric label="Vehículos en stock" value={f.vehiculos} />
                    </div>
                    <div className="mt-16">
                      <div className="overline mb-12">Cierres en el rango</div>
                      <div className="progress"><span style={{ width: `${(f.cierres / maxC) * 100}%` }} /></div>
                    </div>
                  </Card>
                )
              })}
            </div>
            <div className="text-3 mt-16" style={{ fontSize: 11.5 }}>Efectividad = cierres (ventas) ÷ oportunidades creadas en el rango. Cierres, ingresos y oportunidades creadas se miden en el rango; leads, oport. abiertas y vehículos son totales actuales.</div>
          </>
        )}
      </Page>
    </>
  )
}

const PIE_COLORS = ['var(--cyan)', 'var(--green)', 'var(--amber)', 'var(--violet)', 'var(--ink)', 'var(--red)']
function MiniPie({ rows }) {
  const total = rows.reduce((a, [, x]) => a + x.n, 0)
  if (!total) return <div className="text-3" style={{ fontSize: 12.5, padding: '4px 0' }}>Sin ventas en el rango.</div>
  const r = 42, c = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="row gap-16" style={{ alignItems: 'center' }}>
      <svg width="96" height="96" viewBox="0 0 104 104" style={{ flexShrink: 0 }}>
        <g transform="rotate(-90 52 52)">
          {rows.map(([f, x], i) => {
            const len = (x.n / total) * c
            const seg = <circle key={f} cx="52" cy="52" r={r} fill="none" stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} />
            acc += len
            return seg
          })}
        </g>
        <text x="52" y="52" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-num)' }} fill="var(--text)">{total}</text>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        {rows.map(([f, x], i) => (
          <div key={f} className="row gap-8" style={{ fontSize: 11.5, padding: '2px 0' }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
            <span className="num text-2">{x.n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Metric({ label, value, tone }) {
  return (
    <div>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone || ''}`} style={{ fontSize: 20, marginTop: 3 }}>{value}</div>
    </div>
  )
}

function deltaSub(cur, prev, label) {
  const d = pctDelta(cur, prev)
  if (d === null) return `sin base · ${label}`
  return <span className={d >= 0 ? 'up' : 'down'}>{d >= 0 ? '▲' : '▼'} {Math.abs(d)}% vs {label}</span>
}

function AlertRow({ children, tone }) {
  const color = { cyan: 'var(--cyan)', amber: 'var(--amber)', violet: 'var(--violet)', green: 'var(--green)', red: 'var(--red)' }[tone] || 'var(--cyan)'
  return (
    <div className="row gap-8" style={{ padding: '9px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  )
}
