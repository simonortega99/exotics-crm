import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { useAuth } from '../lib/auth.jsx'
import { fmtDate, today, picoPlacaRestringido, weekdayOf, DIAS_LV, ASESORES } from '../lib/utils.js'
import { Topbar, Page, Field, Modal, ModalButtons, Badge, Kebab } from '../components/ui.jsx'
import Calendar from '../components/Calendar.jsx'
import { toast } from '../components/feedback.jsx'
import { crearCita } from '../lib/citas.js'
import { calActualizar, calEliminar } from '../lib/calendar.js'
import { CalendarClock } from 'lucide-react'

const vehName = v => v ? `${v.marca} ${v.modelo} ${v.anio || ''}`.trim() : ''
const DIAS_SEM = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function Citas() {
  const { data, addItem, updateItem, deleteItem, restoreItem, setField } = useStore()
  const { user, isAdmin } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const [selDay, setSelDay] = useState(today())
  const [dayModal, setDayModal] = useState(null) // fecha del día abierto en detalle

  const picoPlaca = data.picoPlaca || {}
  const invActivo = data.inventario.filter(v => v.estado !== 'Vendido')
  const leads = isAdmin ? data.leads : data.leads.filter(l => l.owner === user.nombre)
  const oportunidades = isAdmin ? (data.oportunidades || []) : (data.oportunidades || []).filter(o => o.owner === user.nombre)
  const asesores = data.asesores || ASESORES
  const ownerOptions = isAdmin ? asesores : [user.nombre]

  const todas = (data.citas || []).filter(c => isAdmin || c.owner === user.nombre)
  const events = todas.map(c => ({ id: c.id, date: c.fecha, label: `${c.hora ? c.hora + ' ' : ''}${c.cliente || c.vehiculo || 'Cita'}`, tone: c.done ? 'done' : (picoPlacaRestringido(c.placa, c.motor, c.fecha, picoPlaca) ? 'red' : 'cyan') }))
  const proximas = todas.filter(c => !c.done && c.fecha >= today()).sort((a, b) => (a.fecha + (a.hora || '') > b.fecha + (b.hora || '') ? 1 : -1))
  const wd = weekdayOf(selDay)
  const diaNombre = DIAS_SEM[wd] || ''
  const ppDigs = (wd >= 1 && wd <= 5) ? (picoPlaca[wd] || []) : []

  function openForm(date) { setEditing(null); setShowForm(true); setSelDay(date || selDay) }

  function guardar(f) {
    const v = data.inventario.find(x => x.id === f.vehiculoId)
    const cliente = data.leads.find(l => l.id === f.clienteId)
    const cita = {
      fecha: f.fecha, hora: f.hora, lugar: f.lugar, nota: f.nota,
      clienteId: f.clienteId, cliente: cliente?.nombre || '',
      vehiculoId: f.vehiculoId, vehiculo: v ? vehName(v) : '', placa: v?.placa || '', motor: v?.motor || '',
      owner: f.owner || user.nombre, done: editing ? editing.done : false,
    }
    const guests = [(data.equipo || []).find(e => e.nombre === cita.owner)?.email, data.leads.find(l => l.id === cita.clienteId)?.email]
    if (editing) {
      updateItem('citas', editing.id, cita)
      if (editing.actId) updateItem('actividades', editing.actId, { fecha: cita.fecha, titulo: `Cita: ${cita.cliente || cita.vehiculo || 'vehículo'}`, lead: cita.cliente, vehiculo: cita.vehiculo })
      calActualizar({ ...editing, ...cita, calKey: editing.calKey }, editing.fecha, guests)
      toast('Cita actualizada')
    } else {
      crearCita(addItem, updateItem, cita, guests)
      toast('Cita programada · visible en Actividades')
    }
    setShowForm(false); setEditing(null)
  }

  function toggle(c) {
    updateItem('citas', c.id, { done: !c.done })
    if (c.actId) updateItem('actividades', c.actId, { done: !c.done })
  }
  function eliminar(c) {
    const act = c.actId ? (data.actividades || []).find(a => a.id === c.actId) : null
    deleteItem('citas', c.id)
    if (c.actId) deleteItem('actividades', c.actId)
    calEliminar(c)
    toast('Cita eliminada', 'info', { label: 'Deshacer', fn: () => { restoreItem('citas', c); if (act) restoreItem('actividades', act) } })
  }

  return (
    <>
      <Topbar title="Citas" sub="Muestras de vehículos a clientes">
        {isAdmin && <button className="btn" onClick={() => setShowConfig(true)}><CalendarClock size={14} /> Pico y placa</button>}
        <button className="btn cyan" onClick={() => openForm(selDay)}>+ Nueva cita</button>
      </Topbar>
      <Page>
        <div className="card mb-16">
          <div className="row gap-12 wrap" style={{ alignItems: 'center' }}>
            <span className="card-title">Pico y placa · {diaNombre} {fmtDate(selDay)}</span>
            {(wd >= 1 && wd <= 5)
              ? (ppDigs.length
                  ? <div className="row gap-6">{ppDigs.map(d => <span key={d} className="badge red" style={{ minWidth: 26, justifyContent: 'center', fontSize: 13 }}>{d}</span>)}</div>
                  : <span className="text-2" style={{ fontSize: 13 }}>Sin dígitos restringidos este día</span>)
              : <span className="text-2" style={{ fontSize: 13 }}>Fin de semana · sin pico y placa</span>}
            <span className="text-3" style={{ fontSize: 11, marginLeft: 'auto' }}>Selecciona un día en el calendario. Híbridos y eléctricos exentos.</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
          <div className="card">
            <Calendar events={events} selectedDate={selDay} onSelectDay={setSelDay} onDayDoubleClick={d => { setSelDay(d); setDayModal(d) }} />
            <div className="text-3 mt-8" style={{ fontSize: 11 }}>Doble clic en un día para ver y gestionar sus citas.</div>
          </div>
          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="row between mb-12">
              <span className="section-title" style={{ fontSize: 14 }}>Próximas citas</span>
              <button className="btn cyan sm" onClick={() => openForm(selDay)}>+ Cita</button>
            </div>
            {proximas.map(c => {
              const pp = picoPlacaRestringido(c.placa, c.motor, c.fecha, picoPlaca)
              return (
                <div key={c.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                  <div className="row between gap-8">
                    <label className="row gap-8" style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}>
                      <input type="checkbox" checked={!!c.done} onChange={() => toggle(c)} />
                      <span className="cell-strong" style={{ fontSize: 12.5 }}>{c.cliente || '—'}</span>
                    </label>
                    <Kebab items={[
                      { label: 'Editar', onClick: () => { setEditing(c); setShowForm(true) } },
                      { label: 'Eliminar', danger: true, onClick: () => eliminar(c) },
                    ]} />
                  </div>
                  <div className="text-3" style={{ fontSize: 11.5, paddingLeft: 24 }}>
                    {fmtDate(c.fecha)}{c.hora ? ` · ${c.hora}` : ''} · {c.vehiculo || 'Vehículo'}{c.placa ? ` · ${c.placa}` : ''} {pp && <Badge tone="red">pico y placa</Badge>}
                  </div>
                </div>
              )
            })}
            {!proximas.length && <div className="text-3" style={{ fontSize: 12.5, padding: '6px 0' }}>Sin citas próximas.</div>}
          </div>
        </div>
        <div className="text-3 mt-8" style={{ fontSize: 11.5 }}>Los vehículos híbridos y eléctricos están exentos de pico y placa. Configura los días desde el botón "Pico y placa".</div>
      </Page>

      {dayModal && (
        <DayModal
          fecha={dayModal}
          citas={todas.filter(c => c.fecha === dayModal).sort((a, b) => ((a.hora || '') > (b.hora || '') ? 1 : -1))}
          picoPlaca={picoPlaca}
          onToggle={toggle}
          onEdit={c => { setDayModal(null); setEditing(c); setShowForm(true) }}
          onEliminar={eliminar}
          onNueva={() => { setDayModal(null); openForm(dayModal) }}
          onClose={() => setDayModal(null)}
        />
      )}
      {showForm && <CitaForm initial={editing} presetFecha={selDay} leads={leads} oportunidades={oportunidades} inventario={invActivo} asesores={ownerOptions} picoPlaca={picoPlaca}
        onSave={guardar} onClose={() => { setShowForm(false); setEditing(null) }} />}
      {showConfig && <PicoPlacaModal picoPlaca={picoPlaca} onSave={pp => { setField('picoPlaca', pp); toast('Pico y placa actualizado') }} onClose={() => setShowConfig(false)} />}
    </>
  )
}

// Detalle de un día: lista las citas de esa fecha con completar / editar / eliminar.
function DayModal({ fecha, citas, picoPlaca, onToggle, onEdit, onEliminar, onNueva, onClose }) {
  const wd = weekdayOf(fecha)
  return (
    <Modal title={`Citas · ${DIAS_SEM[wd] || ''} ${fmtDate(fecha)}`} onClose={onClose} width={480}
      footer={<><button className="btn" onClick={onClose}>Cerrar</button><button className="btn cyan" onClick={onNueva}>+ Nueva cita</button></>}>
      {!citas.length && <div className="text-3" style={{ fontSize: 13, padding: '8px 0' }}>No hay citas este día. Usa "+ Nueva cita" para agendar una.</div>}
      {citas.map((c, i) => {
        const pp = picoPlacaRestringido(c.placa, c.motor, c.fecha, picoPlaca)
        return (
          <div key={c.id} className="row between gap-8" style={{ padding: '10px 0', borderBottom: i < citas.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <label className="row gap-8" style={{ flex: 1, cursor: 'pointer', minWidth: 0, alignItems: 'flex-start' }}>
              <input type="checkbox" checked={!!c.done} onChange={() => onToggle(c)} style={{ marginTop: 3 }} />
              <div style={{ minWidth: 0 }}>
                <div className="cell-strong" style={{ fontSize: 13, textDecoration: c.done ? 'line-through' : 'none', opacity: c.done ? .6 : 1 }}>
                  {c.hora ? `${c.hora} · ` : ''}{c.cliente || 'Sin cliente'}
                </div>
                <div className="text-3" style={{ fontSize: 11.5 }}>
                  {c.vehiculo || 'Vehículo'}{c.placa ? ` · ${c.placa}` : ''}{c.lugar ? ` · ${c.lugar}` : ''} {pp && <Badge tone="red">pico y placa</Badge>}
                </div>
                {c.nota && <div className="text-3" style={{ fontSize: 11 }}>{c.nota}</div>}
              </div>
            </label>
            <Kebab items={[
              { label: 'Editar', onClick: () => onEdit(c) },
              { label: 'Eliminar', danger: true, onClick: () => onEliminar(c) },
            ]} />
          </div>
        )
      })}
    </Modal>
  )
}

function CitaForm({ initial, presetFecha, leads, oportunidades, inventario, asesores, picoPlaca, onSave, onClose }) {
  const [form, setForm] = useState(initial
    ? { fecha: initial.fecha, hora: initial.hora || '', clienteId: initial.clienteId || '', vehiculoId: initial.vehiculoId || '', lugar: initial.lugar || '', nota: initial.nota || '', owner: initial.owner }
    : { fecha: presetFecha || today(), hora: '', clienteId: '', vehiculoId: '', lugar: '', nota: '', owner: asesores[0] || 'Simón' })
  const set = (k, v) => setForm({ ...form, [k]: v })
  const veh = inventario.find(v => v.id === form.vehiculoId) || (initial && initial.vehiculoId ? { placa: initial.placa, motor: initial.motor } : null)
  const pp = veh && picoPlacaRestringido(veh.placa, veh.motor, form.fecha, picoPlaca)

  const interesados = new Set()
  if (form.vehiculoId) {
    leads.forEach(l => { if (l.vehiculoId === form.vehiculoId) interesados.add(l.id) })
    oportunidades.forEach(o => { if (o.vehiculoId === form.vehiculoId && o.contactoId) interesados.add(o.contactoId) })
  }
  const sugeridos = leads.filter(l => interesados.has(l.id))
  const resto = leads.filter(l => !interesados.has(l.id))

  return (
    <Modal title={initial ? 'Editar cita' : 'Nueva cita'} onClose={onClose} width={460}
      footer={<ModalButtons onClose={onClose} onSave={() => onSave(form)} disabled={!form.clienteId && !form.vehiculoId} saveLabel={initial ? 'Guardar cambios' : 'Agendar'} />}>
      <Field label="Vehículo a mostrar">
        <select className="select" value={form.vehiculoId} onChange={e => set('vehiculoId', e.target.value)}>
          <option value="">— Seleccionar vehículo —</option>
          {inventario.map(v => <option key={v.id} value={v.id}>{vehName(v)}{v.placa ? ` · ${v.placa}` : ''}</option>)}
        </select>
      </Field>
      <Field label="Cliente">
        <select className="select" value={form.clienteId} onChange={e => set('clienteId', e.target.value)}>
          <option value="">— Seleccionar contacto —</option>
          {sugeridos.length > 0 && (
            <optgroup label="⭐ Interesados en este vehículo">
              {sugeridos.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </optgroup>
          )}
          <optgroup label={sugeridos.length ? 'Otros contactos' : 'Contactos'}>
            {resto.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </optgroup>
        </select>
      </Field>
      <div className="form-grid cols-2">
        <Field label="Fecha"><input className="input" type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></Field>
        <Field label="Hora"><input className="input" type="time" value={form.hora} onChange={e => set('hora', e.target.value)} /></Field>
      </div>
      {veh && (
        <div className="card" style={{ background: pp ? 'var(--red-soft)' : 'var(--green-soft)', boxShadow: 'none', padding: '9px 12px', marginBottom: 12, fontSize: 12.5, fontWeight: 600, color: pp ? 'var(--red)' : 'var(--green)' }}>
          {pp ? `⚠️ Pico y placa ese día (placa ${veh.placa}). Elige otra fecha o vehículo.` : 'Sin pico y placa ese día ✓'}
        </div>
      )}
      <div className="form-grid cols-2">
        <Field label="Lugar"><input className="input" value={form.lugar} onChange={e => set('lugar', e.target.value)} placeholder="Ej. Vitrina, domicilio…" /></Field>
        <Field label="Asesor">
          <select className="select" value={form.owner} onChange={e => set('owner', e.target.value)}>{asesores.map(a => <option key={a}>{a}</option>)}</select>
        </Field>
      </div>
      <Field label="Nota"><input className="input" value={form.nota} onChange={e => set('nota', e.target.value)} placeholder="Opcional" /></Field>
    </Modal>
  )
}

function PicoPlacaModal({ picoPlaca, onSave, onClose }) {
  const [config, setConfig] = useState(() => {
    const c = {}
    DIAS_LV.forEach(([k]) => { c[k] = [...(picoPlaca[k] || [])].map(Number) })
    return c
  })
  const toggle = (dia, dig) => setConfig(c => {
    const arr = c[dia].includes(dig) ? c[dia].filter(x => x !== dig) : [...c[dia], dig]
    return { ...c, [dia]: arr }
  })

  return (
    <Modal title="Configurar pico y placa" onClose={onClose} width={480}
      footer={<ModalButtons onClose={onClose} onSave={() => { onSave(config); onClose() }} saveLabel="Guardar" />}>
      <div className="text-3 mb-12" style={{ fontSize: 12 }}>
        Marca los dígitos finales de placa restringidos cada día. Cambia cada semestre, actualízalo aquí. Híbridos y eléctricos quedan exentos automáticamente.
      </div>
      {DIAS_LV.map(([k, nombre]) => (
        <div key={k} className="row gap-8" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
          <span style={{ width: 90, fontWeight: 600, fontSize: 13 }}>{nombre}</span>
          <div className="row gap-6 wrap" style={{ flex: 1 }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
              <button key={d} className={`chip${config[k].includes(d) ? ' on' : ''}`} style={{ minWidth: 32, justifyContent: 'center' }} onClick={() => toggle(k, d)}>{d}</button>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  )
}
