import { useState, useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import {
  fmtMoney, fmtMoneyShort, fmtDate, fmtRange, today, daysSince, num, ASESORES,
  inRange, monthRange, yearRange, ytdRange, shiftYear, addMonths, nextBirthdayDate,
} from '../lib/utils.js'
import { Topbar, Page, Kpi, Card, Field, Modal, ModalButtons, Badge, EmptyRow, NumberInput, Kebab } from '../components/ui.jsx'
import { toast, confirmDelete } from '../components/feedback.jsx'
import { useAuth } from '../lib/auth.jsx'

function metrics(arr) {
  const unidades = arr.length
  const ingresos = arr.reduce((a, v) => a + (num(v.ganancia) || num(v.comision)), 0) // comisión o ganancia de retoma
  const volumen = arr.reduce((a, v) => a + num(v.precio), 0)
  const ticket = unidades ? Math.round(volumen / unidades) : 0
  return { unidades, ingresos, volumen, ticket }
}
const pctDelta = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null)
const FUENTES = ['Directo', 'Instagram', 'Referido', 'Mercado Libre', 'VTN', 'Otro']
const ORIGEN_CREDITO = ['Ninguno', 'Propio', 'Tercero']

export default function Ventas() {
  const { data, addItem, updateItem, deleteItem } = useStore()
  const { user, isAdmin } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [modo, setModo] = useState('simple') // simple | comparar

  const ventas = isAdmin ? data.ventas : data.ventas.filter(v => v.owner === user.nombre)
  const ownerOptions = isAdmin ? (data.asesores || ASESORES) : [user.nombre]
  const visibleLeads = isAdmin ? data.leads : data.leads.filter(l => l.owner === user.nombre)

  const now = new Date()
  const [mA] = useState(monthRange(now.getFullYear(), now.getMonth() + 1))
  const [aDesde, setADesde] = useState(mA[0])
  const [aHasta, setAHasta] = useState(mA[1])
  const [bRange] = useState(monthRange(now.getFullYear() - 1, now.getMonth() + 1))
  const [bDesde, setBDesde] = useState(bRange[0])
  const [bHasta, setBHasta] = useState(bRange[1])

  const enA = useMemo(() => ventas.filter(v => inRange(v.fecha, aDesde, aHasta)), [ventas, aDesde, aHasta])
  const enB = useMemo(() => ventas.filter(v => inRange(v.fecha, bDesde, bHasta)), [ventas, bDesde, bHasta])
  const [pDesde, pHasta] = shiftYear([aDesde, aHasta], -1)
  const prevYearA = useMemo(() => ventas.filter(v => inRange(v.fecha, pDesde, pHasta)), [ventas, pDesde, pHasta])

  const mtA = metrics(enA), mtB = metrics(enB), mtPrev = metrics(prevYearA)

  function handleSave(form) {
    const vehiculo = data.inventario.find(v => v.id === form.vehiculoId)
    const cliente = data.leads.find(l => l.id === form.clienteId)
    const diasVenta = vehiculo?.fechaIngreso ? daysSince(vehiculo.fechaIngreso) : 0
    addItem('ventas', {
      fecha: form.fecha,
      vehiculo: vehiculo ? `${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio || ''}`.trim() : (form.vehiculoLibre || ''),
      vehiculoId: form.vehiculoId || '', cliente: cliente?.nombre || '', clienteId: form.clienteId || '',
      precio: num(form.precio), comisionPct: form.comisionPct, comision: num(form.comision),
      ganancia: num(form.ganancia) || num(form.comision), owner: form.owner || 'Simón',
      fuente: form.fuente, credito: form.credito, seguro: form.seguro,
      diasVenta, esAliado: !vehiculo,
    })
    if (vehiculo) updateItem('inventario', vehiculo.id, { estado: 'Vendido' })
    if (cliente) {
      const eraCliente = cliente.rol === 'cliente'
      updateItem('leads', cliente.id, { rol: 'cliente' })
      ;(data.oportunidades || [])
        .filter(o => o.contactoId === cliente.id && o.estado === 'Abierta' && (!vehiculo || !o.vehiculoId || o.vehiculoId === vehiculo.id))
        .forEach(o => updateItem('oportunidades', o.id, { estado: 'Ganada' }))
      // Primera compra → generar plan de fidelización automático desde las plantillas
      if (!eraCliente) {
        const plantillas = data.fidelidadPlantillas || []
        let generadas = 0
        plantillas.forEach(p => {
          const fecha = p.base === 'cumple' ? nextBirthdayDate(cliente.cumple) : addMonths(form.fecha, p.meses)
          if (!fecha) return // sin cumpleaños registrado → se omite esa actividad
          addItem('actividades', { titulo: p.titulo, fecha, tipo: 'Fidelización', cliente: cliente.nombre, lead: cliente.nombre, owner: form.owner || 'Simón', done: false, auto: true })
          generadas++
        })
        if (generadas) setTimeout(() => toast(`Plan de fidelización generado (${generadas} actividades)`, 'info'), 250)
      }
    }
    setShowForm(false)
    toast('Venta registrada')
  }

  const curY = now.getFullYear(), curM = now.getMonth() + 1
  const setRange = ([d, h]) => { setADesde(d); setAHasta(h) }
  const presets = [
    ['Este mes', monthRange(curY, curM)],
    ['Mes pasado', monthRange(new Date(curY, curM - 2, 1).getFullYear(), new Date(curY, curM - 2, 1).getMonth() + 1)],
    ['YTD', ytdRange(curY)],
    ['Este año', yearRange(curY)],
    ['Año pasado', yearRange(curY - 1)],
  ]

  return (
    <>
      <Topbar title="Ventas" sub={modo === 'simple' ? fmtRange(aDesde, aHasta) : `${fmtRange(aDesde, aHasta)} vs ${fmtRange(bDesde, bHasta)}`}>
        <button className="btn cyan" onClick={() => setShowForm(true)}>+ Registrar venta</button>
      </Topbar>
      <Page>
        <div className="filters">
          <div className="seg">
            <button className={modo === 'simple' ? 'on' : ''} onClick={() => setModo('simple')}>Periodo</button>
            <button className={modo === 'comparar' ? 'on' : ''} onClick={() => setModo('comparar')}>Comparar 2 rangos</button>
          </div>
        </div>

        <Card className="mb-16">
          <div className="row gap-12 wrap" style={{ alignItems: 'flex-end' }}>
            <RangePicker label={modo === 'comparar' ? 'Rango A' : 'Desde / Hasta'} desde={aDesde} hasta={aHasta} setDesde={setADesde} setHasta={setAHasta} tone="var(--cyan)" />
            {modo === 'comparar' && <RangePicker label="Rango B" desde={bDesde} hasta={bHasta} setDesde={setBDesde} setHasta={setBHasta} tone="var(--line-strong)" />}
          </div>
          {modo === 'simple' && (
            <>
              <div style={{ borderTop: '1px solid var(--line)', margin: '18px 0 0' }} />
              <div className="row gap-8 wrap" style={{ marginTop: 16, alignItems: 'center' }}>
                <span className="overline" style={{ marginRight: 4 }}>Atajos</span>
                {presets.map(([label, r]) => (
                  <button key={label} className={`chip${aDesde === r[0] && aHasta === r[1] ? ' on' : ''}`} onClick={() => setRange(r)}>{label}</button>
                ))}
              </div>
            </>
          )}
        </Card>

        {modo === 'simple' ? (
          <>
            <div className="kpi-grid mb-16">
              <Kpi label="Unidades vendidas" value={mtA.unidades} accent="cyan"
                sub={deltaSub(mtA.unidades, mtPrev.unidades, 'vs año ant.')} />
              <Kpi label="Ingresos generados" value={fmtMoneyShort(mtA.ingresos)} valueClass="green" accent="green"
                sub={deltaSub(mtA.ingresos, mtPrev.ingresos, 'vs año ant.')} />
              <Kpi label="Volumen vendido" value={fmtMoneyShort(mtA.volumen)} accent="ink"
                sub={deltaSub(mtA.volumen, mtPrev.volumen, 'vs año ant.')} />
              <Kpi label="Ticket promedio" value={fmtMoneyShort(mtA.ticket)} accent="amber"
                sub={deltaSub(mtA.ticket, mtPrev.ticket, 'vs año ant.')} />
            </div>
            <Card title={`Comparativa vs mismo periodo de ${pDesde?.slice(0, 4)}`} className="mb-16">
              <CompareRow label="Unidades" a={mtA.unidades} b={mtPrev.unidades} fmt={v => v} />
              <CompareRow label="Ingresos generados" a={mtA.ingresos} b={mtPrev.ingresos} fmt={fmtMoneyShort} />
              <CompareRow label="Volumen vendido" a={mtA.volumen} b={mtPrev.volumen} fmt={fmtMoneyShort} />
              <CompareRow label="Ticket promedio" a={mtA.ticket} b={mtPrev.ticket} fmt={fmtMoneyShort} />
            </Card>
          </>
        ) : (
          <Card title="Comparativa de rangos" className="mb-16">
            <div className="row" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: .6, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
              <span style={{ flex: 1 }}>Métrica</span>
              <span style={{ width: 120, textAlign: 'right' }}>A · {fmtRange(aDesde, aHasta)}</span>
              <span style={{ width: 120, textAlign: 'right' }}>B · {fmtRange(bDesde, bHasta)}</span>
              <span style={{ width: 90, textAlign: 'right' }}>Δ</span>
            </div>
            <CompareRow label="Unidades" a={mtA.unidades} b={mtB.unidades} fmt={v => v} />
            <CompareRow label="Ingresos generados" a={mtA.ingresos} b={mtB.ingresos} fmt={fmtMoneyShort} />
            <CompareRow label="Volumen vendido" a={mtA.volumen} b={mtB.volumen} fmt={fmtMoneyShort} />
            <CompareRow label="Ticket promedio" a={mtA.ticket} b={mtB.ticket} fmt={fmtMoneyShort} />
          </Card>
        )}

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>{['Fecha', 'Vehículo', 'Cliente', 'Asesor', 'Fuente', 'Precio', 'Ingreso', 'Origen', ''].map((h, i) => <th key={i}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {[...enA].sort((x, y) => (x.fecha < y.fecha ? 1 : -1)).map(v => (
                <tr key={v.id}>
                  <td className="num">{fmtDate(v.fecha)}</td>
                  <td className="cell-strong">{v.vehiculo || '—'}</td>
                  <td>{v.cliente || <span className="muted">—</span>}</td>
                  <td className="text-2">{v.owner || '—'}</td>
                  <td className="text-2">
                    {v.fuente || '—'}
                    {((v.credito && v.credito !== 'Ninguno') || (v.seguro && v.seguro !== 'Ninguno')) && (
                      <div className="text-3" style={{ fontSize: 10 }}>
                        {[v.credito && v.credito !== 'Ninguno' && `Créd: ${v.credito}`, v.seguro && v.seguro !== 'Ninguno' && `Seg: ${v.seguro}`].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="cell-money t-cyan">{fmtMoney(v.precio)}</td>
                  <td className="cell-money t-green">{fmtMoney(num(v.ganancia) || num(v.comision))}</td>
                  <td><Badge tone={v.esAliado ? 'amber' : 'cyan'}>{v.esAliado ? 'Aliado' : 'Inventario'}</Badge></td>
                  <td>
                    <Kebab items={[
                      { label: 'Editar', onClick: () => setEditing(v) },
                      { label: 'Eliminar', danger: true, onClick: () => confirmDelete('la venta', () => deleteItem('ventas', v.id)) },
                    ]} />
                  </td>
                </tr>
              ))}
              {!enA.length && <EmptyRow colSpan={9}><div className="big">Sin ventas en el rango</div>Ajusta las fechas o registra una venta.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Page>

      {showForm && <VentaForm leads={visibleLeads} asesores={ownerOptions} inventario={data.inventario.filter(v => v.estado !== 'Vendido')}
        onSave={handleSave} onClose={() => setShowForm(false)} />}
      {editing && <VentaEditForm venta={editing} leads={visibleLeads} asesores={ownerOptions}
        onSave={upd => { updateItem('ventas', editing.id, upd); setEditing(null); toast('Venta actualizada') }} onClose={() => setEditing(null)} />}
    </>
  )
}

function VentaEditForm({ venta, leads, asesores, onSave, onClose }) {
  const [form, setForm] = useState({
    fecha: venta.fecha || today(), owner: venta.owner || asesores[0] || 'Simón',
    clienteId: venta.clienteId || '', precio: venta.precio || '', comision: venta.comision || '', ganancia: venta.ganancia || '',
    fuente: venta.fuente || 'Directo', credito: venta.credito || 'Ninguno', seguro: venta.seguro || 'Ninguno',
  })
  const set = (k, v) => setForm({ ...form, [k]: v })
  function save() {
    const cliente = leads.find(l => l.id === form.clienteId)
    onSave({
      fecha: form.fecha, owner: form.owner,
      clienteId: form.clienteId, cliente: cliente ? cliente.nombre : venta.cliente,
      precio: num(form.precio), comision: num(form.comision), ganancia: num(form.ganancia) || num(form.comision),
      fuente: form.fuente, credito: form.credito, seguro: form.seguro,
    })
  }
  return (
    <Modal title={`Editar venta · ${venta.vehiculo || ''}`} onClose={onClose} width={460}
      footer={<ModalButtons onClose={onClose} onSave={save} saveLabel="Guardar cambios" />}>
      <div className="form-grid cols-2">
        <Field label="Fecha"><input className="input" type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></Field>
        <Field label="Asesor">
          <select className="select" value={form.owner} onChange={e => set('owner', e.target.value)}>{asesores.map(a => <option key={a}>{a}</option>)}</select>
        </Field>
      </div>
      <Field label="Cliente">
        <select className="select" value={form.clienteId} onChange={e => set('clienteId', e.target.value)}>
          <option value="">{venta.cliente || '— Sin cliente —'}</option>
          {leads.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
      </Field>
      <div className="form-grid cols-2">
        <Field label="Precio de venta"><NumberInput prefix="$" value={form.precio} onChange={v => set('precio', v)} /></Field>
        <Field label="Comisión ($)"><NumberInput prefix="$" value={form.comision} onChange={v => set('comision', v)} /></Field>
      </div>
      <Field label="Ingreso generado (comisión o ganancia)"><NumberInput prefix="$" value={form.ganancia} onChange={v => set('ganancia', v)} /></Field>
      <Field label="Fuente de la venta">
        <select className="select" value={form.fuente} onChange={e => set('fuente', e.target.value)}>{FUENTES.map(f => <option key={f}>{f}</option>)}</select>
      </Field>
      <div className="form-grid cols-2">
        <Field label="Crédito"><select className="select" value={form.credito} onChange={e => set('credito', e.target.value)}>{ORIGEN_CREDITO.map(o => <option key={o}>{o}</option>)}</select></Field>
        <Field label="Seguro"><select className="select" value={form.seguro} onChange={e => set('seguro', e.target.value)}>{ORIGEN_CREDITO.map(o => <option key={o}>{o}</option>)}</select></Field>
      </div>
    </Modal>
  )
}

function deltaSub(cur, prev, label) {
  const d = pctDelta(cur, prev)
  if (d === null) return label.replace('vs', 'sin base')
  return <span className={d >= 0 ? 'up' : 'down'}>{d >= 0 ? '▲' : '▼'} {Math.abs(d)}% {label}</span>
}

function RangePicker({ label, desde, hasta, setDesde, setHasta, tone }) {
  return (
    <div>
      <div className="field-label row gap-6"><span style={{ width: 9, height: 9, borderRadius: 2, background: tone, display: 'inline-block' }} /> {label}</div>
      <div className="row gap-6">
        <input className="input" type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 150 }} />
        <span className="text-3">→</span>
        <input className="input" type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 150 }} />
      </div>
    </div>
  )
}

function CompareRow({ label, a, b, fmt }) {
  const d = pctDelta(a, b)
  return (
    <div className="row" style={{ padding: '9px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
      <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
      <span className="cell-money" style={{ width: 120, textAlign: 'right' }}>{fmt(a)}</span>
      <span className="cell-money text-2" style={{ width: 120, textAlign: 'right' }}>{fmt(b)}</span>
      <span style={{ width: 90, textAlign: 'right', fontWeight: 700 }} className={d === null ? 'text-3' : d >= 0 ? 't-green' : 't-red'}>
        {d === null ? '—' : `${d >= 0 ? '+' : ''}${d}%`}
      </span>
    </div>
  )
}

function VentaForm({ leads, asesores, inventario, onSave, onClose }) {
  const [form, setForm] = useState({ fecha: today(), vehiculoId: '', clienteId: '', owner: asesores[0] || 'Simón', precio: '', comisionPct: '', comision: '', ganancia: '', fuente: 'Directo', credito: 'Ninguno', seguro: 'Ninguno' })

  function pickVehiculo(id) {
    const v = inventario.find(x => x.id === id)
    if (v) {
      const precio = v.precio || '', pct = v.comision || ''
      const comision = precio && pct ? Math.round(num(precio) * num(pct) / 100) : ''
      setForm(f => ({ ...f, vehiculoId: id, precio, comisionPct: pct, comision, ganancia: comision }))
    } else setForm(f => ({ ...f, vehiculoId: id }))
  }
  const recompute = (precio, pct) => (precio !== '' && pct !== '') ? Math.round(num(precio) * num(pct) / 100) : form.comision
  const setPrecio = val => setForm(f => { const c = recompute(val, f.comisionPct); return { ...f, precio: val, comision: c, ganancia: f.ganancia === f.comision || f.ganancia === '' ? c : f.ganancia } })
  const setPct = val => setForm(f => { const c = recompute(f.precio, val); return { ...f, comisionPct: val, comision: c, ganancia: f.ganancia === f.comision || f.ganancia === '' ? c : f.ganancia } })

  return (
    <Modal title="Registrar venta" onClose={onClose} width={470}
      footer={<ModalButtons onClose={onClose} onSave={() => onSave(form)} disabled={!form.precio} />}>
      <Field label="Vehículo (inventario)">
        <select className="select" value={form.vehiculoId} onChange={e => pickVehiculo(e.target.value)}>
          <option value="">— Venta sin inventario (aliado) —</option>
          {inventario.map(v => <option key={v.id} value={v.id}>{v.marca} {v.modelo} {v.anio} — {fmtMoney(v.precio)}{v.comision ? ` · ${v.comision}%` : ''}</option>)}
        </select>
      </Field>
      <div className="form-grid cols-2">
        <Field label="Cliente">
          <select className="select" value={form.clienteId} onChange={e => setForm({ ...form, clienteId: e.target.value })}>
            <option value="">— Seleccionar cliente —</option>
            {leads.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </Field>
        <Field label="Asesor">
          <select className="select" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })}>{asesores.map(a => <option key={a}>{a}</option>)}</select>
        </Field>
      </div>
      <div className="form-grid cols-2">
        <Field label="Fecha"><input className="input" type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></Field>
        <Field label="Precio de venta"><NumberInput prefix="$" value={form.precio} onChange={setPrecio} /></Field>
      </div>
      <div className="form-grid cols-2">
        <Field label="% Comisión (del vehículo)"><input className="input" value={form.comisionPct} onChange={e => setPct(e.target.value)} placeholder="ej. 5" /></Field>
        <Field label="Comisión ($)"><NumberInput prefix="$" value={form.comision} onChange={v => setForm({ ...form, comision: v })} /></Field>
      </div>
      <Field label="Ingreso generado (comisión o ganancia de retoma)">
        <NumberInput prefix="$" value={form.ganancia} onChange={v => setForm({ ...form, ganancia: v })} placeholder="por defecto = comisión" />
      </Field>
      <Field label="Fuente de la venta">
        <select className="select" value={form.fuente} onChange={e => setForm({ ...form, fuente: e.target.value })}>{FUENTES.map(f => <option key={f}>{f}</option>)}</select>
      </Field>
      <div className="form-grid cols-2">
        <Field label="Crédito">
          <select className="select" value={form.credito} onChange={e => setForm({ ...form, credito: e.target.value })}>{ORIGEN_CREDITO.map(o => <option key={o}>{o}</option>)}</select>
        </Field>
        <Field label="Seguro">
          <select className="select" value={form.seguro} onChange={e => setForm({ ...form, seguro: e.target.value })}>{ORIGEN_CREDITO.map(o => <option key={o}>{o}</option>)}</select>
        </Field>
      </div>
    </Modal>
  )
}
