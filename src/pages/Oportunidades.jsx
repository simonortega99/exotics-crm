import { useState, useMemo, useEffect, useRef, Fragment } from 'react'
import { GripVertical } from 'lucide-react'
import { useStore } from '../lib/store.jsx'
import { OPP_STAGES, ASESORES, THERMO_TONE, thermoForStage, fmtMoney, fmtDate, fmtRange, today, addDays, num, inRange, isOverdue, picoPlacaRestringido } from '../lib/utils.js'
import { Topbar, Page, Kpi, Field, Modal, ModalButtons, Badge, EmptyRow, VehiculoInteresSelect, NumberInput, Kebab } from '../components/ui.jsx'
import { toast } from '../components/feedback.jsx'
import { useAuth } from '../lib/auth.jsx'
import { crearCita } from '../lib/citas.js'
import { registrarVenta } from '../lib/ventas.js'
import { VentaForm } from './Ventas.jsx'

const ESTADO_TONE = { Abierta: 'cyan', Ganada: 'green', Perdida: 'red' }
const THERMO = THERMO_TONE
const THERMO_COLOR = { frio: 'var(--cyan-700)', tibio: 'var(--amber)', caliente: 'var(--red)' }
const FILTROS = [
  { k: 'abiertas', label: 'Abiertas' },
  { k: 'caliente', label: 'Calientes' },
  { k: 'tibio', label: 'Tibios' },
  { k: 'frio', label: 'Fríos' },
  { k: 'cerradas', label: 'Cerradas' },
]

export default function Oportunidades() {
  const { data, addItem, updateItem, deleteItemUndo } = useStore()
  const { user, isAdmin } = useAuth()
  const asesores = data.asesores || ASESORES
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [tareaOpp, setTareaOpp] = useState(null)
  const [citaOpp, setCitaOpp] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [ventaOpp, setVentaOpp] = useState(null) // oportunidad que se está convirtiendo en venta
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const [filtro, setFiltro] = useState('abiertas')
  // Por defecto cada quien ve lo suyo (si su nombre está en el equipo); si no, todos.
  const [ownerFilter, setOwnerFilter] = useState(() => asesores.includes(user?.nombre) ? user.nombre : 'todos')
  const filterTouched = useRef(false)
  // Si al montar los datos aún no habían cargado, en cuanto se resuelve el nombre
  // del usuario se ajusta el filtro a lo suyo (salvo que ya lo haya cambiado a mano).
  useEffect(() => {
    if (filterTouched.current) return
    if (user?.nombre && asesores.includes(user.nombre) && ownerFilter === 'todos') setOwnerFilter(user.nombre)
  }, [user?.nombre, asesores])
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const ownerOptions = isAdmin ? asesores : [user.nombre]

  const allOps = data.oportunidades || []
  const ops = isAdmin ? allOps : allOps.filter(o => o.owner === user.nombre)
  const visibleLeads = isAdmin ? data.leads : data.leads.filter(l => l.owner === user.nombre)
  const invActivo = data.inventario.filter(v => v.estado !== 'Vendido')
  const thermoOf = o => data.leads.find(l => l.id === o.contactoId)?.thermo
  // Status: sin actividades → nada; con tarea vencida → "Sin seguimiento"; si no → "Al día".
  const statusOf = o => {
    const acts = (data.actividades || []).filter(a => !a.done && (a.oppId === o.id || a.leadId === o.contactoId))
    if (!acts.length) return null
    if (acts.some(a => isOverdue(a.fecha))) return { label: 'Sin seguimiento', tone: 'red' }
    return { label: 'Al día', tone: 'green' }
  }
  // Actividades pendientes ligadas a una oportunidad (por la opp o por su contacto).
  const pendientesDe = o => (data.actividades || [])
    .filter(a => !a.done && (a.oppId === o.id || a.leadId === o.contactoId))
    .sort((a, b) => (a.fecha > b.fecha ? 1 : -1))
  const enRango = o => (!desde && !hasta) || inRange(o.fecha, desde || null, hasta || null)
  const abiertas = ops.filter(o => o.estado === 'Abierta' && enRango(o))

  const filtered = useMemo(() => {
    let base = filtro === 'cerradas' ? ops.filter(o => o.estado !== 'Abierta')
      : filtro === 'abiertas' ? abiertas
      : abiertas.filter(o => (thermoOf(o) || 'frio') === filtro)
    if (ownerFilter !== 'todos') base = base.filter(o => o.owner === ownerFilter)
    return base.filter(enRango)
  }, [ops, filtro, ownerFilter, desde, hasta, data.leads])

  // Orden manual: las que tienen `orden` van primero (ascendente); el resto por
  // fecha (más nuevas arriba), como siempre, hasta que se arrastren.
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const ao = a.orden, bo = b.orden
    if (ao != null && bo != null) return ao - bo
    if (ao != null) return -1
    if (bo != null) return 1
    return a.fecha < b.fecha ? 1 : -1
  }), [filtered])

  // Reordena: coloca la arrastrada donde se soltó y reescribe `orden` de la lista visible.
  function reordenar(targetId) {
    const list = [...sorted]
    const from = list.findIndex(o => o.id === dragId)
    const to = list.findIndex(o => o.id === targetId)
    setDragId(null); setOverId(null)
    if (from < 0 || to < 0 || from === to) return
    const [moved] = list.splice(from, 1)
    list.splice(to, 0, moved)
    list.forEach((o, i) => { if (o.orden !== i) updateItem('oportunidades', o.id, { orden: i }) })
  }

  function perder(o) {
    updateItem('oportunidades', o.id, { estado: 'Perdida' })
    toast('Marcada como perdida', 'info', { label: 'Deshacer', fn: () => updateItem('oportunidades', o.id, { estado: 'Abierta' }) })
  }

  const porTemp = t => abiertas.filter(o => thermoOf(o) === t).length
  const calientes = porTemp('caliente'), tibios = porTemp('tibio'), frios = porTemp('frio')
  const ganadas = ops.filter(o => o.estado === 'Ganada' && enRango(o)).length

  // Ganar una oportunidad = registrar la venta: abre el formulario de venta ya
  // prellenado. Al guardar, el vehículo sale del inventario, la oportunidad queda
  // Ganada, el lead pasa a cliente y se crea la entrega (todo en registrarVenta).
  function ganar(o) { setVentaOpp(o) }
  function setTemp(o, thermo) { if (o.contactoId) updateItem('leads', o.contactoId, { thermo }) }
  // Cambiar de etapa ajusta automáticamente la temperatura del contacto
  function setStage(o, stage) {
    updateItem('oportunidades', o.id, { stage })
    if (o.contactoId) updateItem('leads', o.contactoId, { thermo: thermoForStage(stage) })
  }

  return (
    <>
      <Topbar title="Oportunidades" sub={(desde || hasta) ? fmtRange(desde || null, hasta || null) : 'Deals en el pipeline'}>
        <button className="btn cyan" onClick={() => setShowForm(true)}>+ Nueva oportunidad</button>
      </Topbar>
      <Page>
        <div className="kpi-grid mb-16">
          <Kpi label="Abiertas" value={abiertas.length} accent="cyan" />
          <Kpi label="Calientes" value={calientes} accent="amber" valueClass="red" />
          <Kpi label="Tibios" value={tibios} accent="amber" />
          <Kpi label="Fríos" value={frios} accent="cyan" valueClass="cyan" />
          <Kpi label="Ganadas" value={ganadas} accent="green" />
        </div>

        <div className="filters">
          <div className="seg">
            {FILTROS.map(f => <button key={f.k} className={filtro === f.k ? 'on' : ''} onClick={() => setFiltro(f.k)}>{f.label}</button>)}
          </div>
          {isAdmin && (
            <select className="select" style={{ width: 150 }} value={ownerFilter} onChange={e => { filterTouched.current = true; setOwnerFilter(e.target.value) }}>
              <option value="todos">Todos los asesores</option>
              {asesores.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          <div className="row gap-6">
            <input className="input" type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 145 }} title="Desde" />
            <span className="text-3">→</span>
            <input className="input" type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 145 }} title="Hasta" />
            {(desde || hasta) && <button className="btn ghost sm" onClick={() => { setDesde(''); setHasta('') }}>Limpiar</button>}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>{['Contacto', 'Creada', 'Temp.', 'Vehículo de interés', 'Valor est.', 'Etapa', 'Estado', 'Status', ''].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {sorted.map(o => {
                const thermo = thermoOf(o)
                const pend = pendientesDe(o)
                const open = openId === o.id
                const isOver = overId === o.id && dragId && dragId !== o.id
                return (
                  <Fragment key={o.id}>
                  <tr className={open ? 'selected' : ''}
                    onDragOver={e => { if (dragId) { e.preventDefault(); if (overId !== o.id) setOverId(o.id) } }}
                    onDrop={() => reordenar(o.id)}
                    style={{ boxShadow: isOver ? 'inset 0 2px 0 var(--cyan)' : undefined, opacity: dragId === o.id ? .4 : 1 }}>
                    <td onClick={() => setOpenId(open ? null : o.id)} style={{ cursor: 'pointer' }}>
                      <div className="cell-strong" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span draggable onDragStart={e => { e.stopPropagation(); setDragId(o.id) }} onDragEnd={() => { setDragId(null); setOverId(null) }} onClick={e => e.stopPropagation()}
                          title="Arrastra para reordenar" style={{ cursor: 'grab', display: 'inline-flex', color: 'var(--text-3)', flexShrink: 0 }}><GripVertical size={13} /></span>
                        {o.contacto || '—'} <span className="text-3">{pend.length ? (open ? '▾' : '▸') : ''}</span>
                      </div>
                      <div className="text-3" style={{ fontSize: 11, paddingLeft: 17 }}>{o.owner}{pend.length ? ` · ${pend.length} pend.` : ''}</div>
                    </td>
                    <td className="num text-2">{o.fecha ? fmtDate(o.fecha) : '—'}</td>
                    <td>
                      {o.contactoId
                        ? <select className="select" style={{ maxWidth: 110, color: THERMO_COLOR[thermo || 'frio'], fontWeight: 700 }} value={thermo || 'frio'} onChange={e => setTemp(o, e.target.value)}>
                            <option value="frio">Frío</option><option value="tibio">Tibio</option><option value="caliente">Caliente</option>
                          </select>
                        : <span className="muted">—</span>}
                    </td>
                    <td>
                      {o.vehiculoInteres || <span className="muted">Por definir</span>}
                      {o.financiacion && <Badge tone="violet">💳 Financia</Badge>}
                    </td>
                    <td className="cell-money">{fmtMoney(o.valor)}</td>
                    <td>
                      {o.estado === 'Abierta'
                        ? <select className="select" style={{ maxWidth: 170 }} value={o.stage} onChange={e => setStage(o, +e.target.value)}>
                            {OPP_STAGES.map((s, i) => <option key={s} value={i}>{i + 1}. {s}</option>)}
                          </select>
                        : <Badge tone="gray">{OPP_STAGES[o.stage]}</Badge>}
                    </td>
                    <td><Badge tone={ESTADO_TONE[o.estado]} dot>{o.estado}</Badge></td>
                    <td>{o.estado === 'Abierta' ? (() => { const s = statusOf(o); return s ? <Badge tone={s.tone} dot>{s.label}</Badge> : <span className="muted">—</span> })() : <span className="muted">—</span>}</td>
                    <td>
                      <div className="row gap-6">
                        {o.estado === 'Abierta' && <button className="btn sm" onClick={() => perder(o)}>Perder</button>}
                        <Kebab items={[
                          o.contactoId && { label: 'Agendar tarea', onClick: () => setTareaOpp(o) },
                          o.contactoId && { label: 'Agendar cita', onClick: () => setCitaOpp(o) },
                          o.estado === 'Abierta' && { label: 'Editar', onClick: () => setEditing(o) },
                          o.estado === 'Abierta' && { label: 'Marcar ganada', onClick: () => ganar(o) },
                          o.estado !== 'Abierta' && { label: 'Reabrir', onClick: () => { updateItem('oportunidades', o.id, { estado: 'Abierta' }); toast('Oportunidad reabierta') } },
                          { label: 'Eliminar', danger: true, onClick: () => deleteItemUndo('oportunidades', o, 'La oportunidad') },
                        ]} />
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={9} style={{ background: 'var(--surface-2)' }}>
                        <div className="row between mb-8" style={{ alignItems: 'center' }}>
                          <span className="overline">Actividades pendientes</span>
                          {o.contactoId && <button className="btn cyan sm" onClick={() => setTareaOpp(o)}>+ Agendar tarea</button>}
                        </div>
                        {pend.length ? pend.map(a => (
                          <div key={a.id} className="row gap-8" style={{ padding: '7px 2px', borderBottom: '1px solid var(--line)', fontSize: 12.5, alignItems: 'center' }}>
                            <input type="checkbox" checked={!!a.done} onChange={() => updateItem('actividades', a.id, { done: !a.done })} />
                            <span style={{ flex: 1 }}>{a.titulo} <span className="text-3">· {a.tipo}</span></span>
                            <span className={isOverdue(a.fecha) ? 't-red' : 'text-3'} style={{ fontSize: 11.5 }}>{fmtDate(a.fecha)}{isOverdue(a.fecha) ? ' · vencida' : ''}</span>
                          </div>
                        )) : <div className="text-3" style={{ fontSize: 12.5, padding: '4px 2px' }}>Sin actividades pendientes. Usa "+ Agendar tarea" para crear una.</div>}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
              {!filtered.length && <EmptyRow colSpan={9}><div className="big">Sin oportunidades</div>Crea una desde aquí o desde la ficha de un contacto.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Page>

      {showForm && <OppForm leads={visibleLeads} asesores={ownerOptions} inventario={invActivo}
        onSave={f => { addItem('oportunidades', f); if (f.contactoId) updateItem('leads', f.contactoId, { thermo: thermoForStage(f.stage) }); setShowForm(false); toast('Oportunidad creada') }} onClose={() => setShowForm(false)} />}
      {editing && <OppEditForm op={editing} asesores={ownerOptions} inventario={invActivo}
        onSave={updates => { updateItem('oportunidades', editing.id, updates); if (editing.contactoId) updateItem('leads', editing.contactoId, { thermo: thermoForStage(updates.stage) }); setEditing(null); toast('Oportunidad actualizada') }} onClose={() => setEditing(null)} />}
      {tareaOpp && <TareaModal opp={tareaOpp}
        onSave={f => { addItem('actividades', { titulo: f.titulo, fecha: f.fecha, tipo: 'Seguimiento', owner: tareaOpp.owner || 'Simón', lead: tareaOpp.contacto, leadId: tareaOpp.contactoId, oppId: tareaOpp.id, vehiculo: tareaOpp.vehiculoInteres || '', done: false }); setTareaOpp(null); toast('Tarea agendada · visible en Actividades') }}
        onClose={() => setTareaOpp(null)} />}
      {citaOpp && <CitaQuickModal opp={citaOpp} inventario={data.inventario} picoPlaca={data.picoPlaca || {}}
        onSave={c => { crearCita(addItem, updateItem, c, [(data.equipo || []).find(e => e.nombre === c.owner)?.email, data.leads.find(l => l.id === c.clienteId)?.email]); setCitaOpp(null); toast('Cita agendada · visible en Citas y Actividades') }}
        onClose={() => setCitaOpp(null)} />}
      {ventaOpp && <VentaForm leads={visibleLeads} asesores={ownerOptions} inventario={invActivo}
        initial={{ vehiculoId: ventaOpp.vehiculoId || '', clienteId: ventaOpp.contactoId || '', precio: ventaOpp.valor || '', owner: ventaOpp.owner }}
        onSave={form => {
          const { fidelidadGeneradas } = registrarVenta({ data, addItem, updateItem }, form)
          if (fidelidadGeneradas) setTimeout(() => toast(`Plan de fidelización generado (${fidelidadGeneradas} actividades)`, 'info'), 250)
          setVentaOpp(null)
          toast('Venta registrada · vehículo fuera de inventario')
        }}
        onClose={() => setVentaOpp(null)} />}
    </>
  )
}

function OppForm({ leads, asesores, inventario, onSave, onClose }) {
  const [form, setForm] = useState({ contactoId: '', vehiculoId: '', vehiculoInteres: '', valor: '', stage: 0, owner: asesores[0] || 'Simón', financiacion: false, fecha: today() })
  const set = (k, v) => setForm({ ...form, [k]: v })

  function save() {
    const contacto = leads.find(l => l.id === form.contactoId)
    onSave({
      contactoId: form.contactoId, contacto: contacto?.nombre || '',
      vehiculoId: form.vehiculoId, vehiculoInteres: form.vehiculoInteres,
      valor: form.valor, stage: +form.stage, estado: 'Abierta', financiacion: form.financiacion,
      owner: form.owner, fecha: form.fecha || today(),
    })
  }

  return (
    <Modal title="Nueva oportunidad" onClose={onClose} width={460}
      footer={<ModalButtons onClose={onClose} onSave={save} disabled={!form.contactoId} />}>
      <Field label="Contacto">
        <select className="select" value={form.contactoId} onChange={e => set('contactoId', e.target.value)}>
          <option value="">— Seleccionar contacto —</option>
          {leads.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
      </Field>
      <Field label="Vehículo de interés">
        <VehiculoInteresSelect inventario={inventario} value={{ vehiculoId: form.vehiculoId, vehiculoInteres: form.vehiculoInteres }}
          onChange={({ vehiculoId, vehiculoInteres }) => setForm({ ...form, vehiculoId, vehiculoInteres })} />
      </Field>
      <div className="form-grid cols-2">
        <Field label="Valor estimado"><NumberInput prefix="$" placeholder="Opcional" value={form.valor} onChange={v => set('valor', v)} /></Field>
        <Field label="Etapa">
          <select className="select" value={form.stage} onChange={e => set('stage', e.target.value)}>{OPP_STAGES.map((s, i) => <option key={s} value={i}>{i + 1}. {s}</option>)}</select>
        </Field>
      </div>
      <div className="form-grid cols-2">
        <Field label="Owner">
          <select className="select" value={form.owner} onChange={e => set('owner', e.target.value)}>{asesores.map(a => <option key={a}>{a}</option>)}</select>
        </Field>
        <Field label="Fecha de creación"><input className="input" type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></Field>
      </div>
      <Field label="Financiación">
        <label className="row gap-8" style={{ height: 38, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.financiacion} onChange={e => set('financiacion', e.target.checked)} /> Solicita financiación
        </label>
      </Field>
    </Modal>
  )
}

function CitaQuickModal({ opp, inventario, picoPlaca, onSave, onClose }) {
  const veh = inventario.find(v => v.id === opp.vehiculoId)
  const [form, setForm] = useState({ fecha: today(), hora: '', lugar: '' })
  const pp = veh && picoPlacaRestringido(veh.placa, veh.motor, form.fecha, picoPlaca)
  function save() {
    onSave({
      fecha: form.fecha, hora: form.hora, lugar: form.lugar, nota: '',
      clienteId: opp.contactoId, cliente: opp.contacto,
      vehiculoId: opp.vehiculoId || '', vehiculo: veh ? `${veh.marca} ${veh.modelo} ${veh.anio || ''}`.trim() : (opp.vehiculoInteres || ''),
      placa: veh?.placa || '', motor: veh?.motor || '', owner: opp.owner || 'Simón', done: false,
    })
  }
  return (
    <Modal title={`Agendar cita · ${opp.contacto}`} onClose={onClose} width={420}
      footer={<ModalButtons onClose={onClose} onSave={save} saveLabel="Agendar" />}>
      <div className="text-3 mb-12" style={{ fontSize: 12 }}>Vehículo: <b>{veh ? `${veh.marca} ${veh.modelo}` : (opp.vehiculoInteres || 'sin definir')}</b>{veh?.placa ? ` · ${veh.placa}` : ''}</div>
      <div className="form-grid cols-2">
        <Field label="Fecha"><input className="input" type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></Field>
        <Field label="Hora"><input className="input" type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} /></Field>
      </div>
      {veh && <div className="card" style={{ background: pp ? 'var(--red-soft)' : 'var(--green-soft)', boxShadow: 'none', padding: '9px 12px', margin: '4px 0 12px', fontSize: 12.5, fontWeight: 600, color: pp ? 'var(--red)' : 'var(--green)' }}>{pp ? `⚠️ Pico y placa ese día (${veh.placa}).` : 'Sin pico y placa ese día ✓'}</div>}
      <Field label="Lugar"><input className="input" value={form.lugar} onChange={e => setForm({ ...form, lugar: e.target.value })} placeholder="Ej. Vitrina, domicilio…" /></Field>
    </Modal>
  )
}

function TareaModal({ opp, onSave, onClose }) {
  const [form, setForm] = useState({ titulo: '', fecha: today() })
  return (
    <Modal title={`Agendar tarea · ${opp.contacto}`} onClose={onClose} width={400}
      footer={<ModalButtons onClose={onClose} onSave={() => onSave(form)} disabled={!form.titulo.trim()} saveLabel="Agendar" />}>
      <Field label="Tarea"><input className="input" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. Llamar para seguimiento" autoFocus /></Field>
      <Field label="Fecha">
        <div className="row gap-6">
          <input className="input" type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
          {[1, 3, 7, 14].map(n => <button key={n} className="btn sm" onClick={() => setForm({ ...form, fecha: addDays(n) })}>+{n}d</button>)}
        </div>
      </Field>
    </Modal>
  )
}

function OppEditForm({ op, asesores, inventario, onSave, onClose }) {
  const [form, setForm] = useState({
    vehiculoId: op.vehiculoId || '', vehiculoInteres: op.vehiculoInteres || '',
    valor: op.valor || '', stage: +op.stage || 0, owner: op.owner || 'Simón', financiacion: !!op.financiacion, fecha: op.fecha || today(),
  })
  const set = (k, v) => setForm({ ...form, [k]: v })
  return (
    <Modal title={`Editar oportunidad · ${op.contacto}`} onClose={onClose} width={460}
      footer={<ModalButtons onClose={onClose} onSave={() => onSave(form)} saveLabel="Guardar cambios" />}>
      <Field label="Vehículo de interés">
        <VehiculoInteresSelect inventario={inventario} value={{ vehiculoId: form.vehiculoId, vehiculoInteres: form.vehiculoInteres }}
          onChange={({ vehiculoId, vehiculoInteres }) => setForm({ ...form, vehiculoId, vehiculoInteres })} />
      </Field>
      <div className="form-grid cols-2">
        <Field label="Valor estimado"><NumberInput prefix="$" value={form.valor} onChange={v => set('valor', v)} /></Field>
        <Field label="Etapa">
          <select className="select" value={form.stage} onChange={e => set('stage', +e.target.value)}>{OPP_STAGES.map((s, i) => <option key={s} value={i}>{i + 1}. {s}</option>)}</select>
        </Field>
      </div>
      <div className="form-grid cols-2">
        <Field label="Owner">
          <select className="select" value={form.owner} onChange={e => set('owner', e.target.value)}>{asesores.map(a => <option key={a}>{a}</option>)}</select>
        </Field>
        <Field label="Fecha de creación"><input className="input" type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></Field>
      </div>
      <Field label="Financiación">
        <label className="row gap-8" style={{ height: 38, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.financiacion} onChange={e => set('financiacion', e.target.checked)} /> Solicita financiación
        </label>
      </Field>
    </Modal>
  )
}
