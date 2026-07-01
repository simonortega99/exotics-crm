import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { useAuth } from '../lib/auth.jsx'
import { fmtDate, today, isOverdue, inRange, weekRange, picoPlacaRestringido, DIAS_LV, ASESORES } from '../lib/utils.js'
import { Topbar, Page, Kpi, Field, Modal, ModalButtons, Badge, EmptyRow, Kebab } from '../components/ui.jsx'
import Calendar from '../components/Calendar.jsx'
import { toast, confirmDelete } from '../components/feedback.jsx'
import { CalendarClock } from 'lucide-react'

const vehName = v => v ? `${v.marca} ${v.modelo} ${v.anio || ''}`.trim() : ''

export default function Citas() {
  const { data, addItem, updateItem, deleteItem, setField } = useStore()
  const { user, isAdmin } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const [vista, setVista] = useState('lista')
  const [filtro, setFiltro] = useState('semana') // hoy | semana
  const [selDay, setSelDay] = useState(today())
  const [formDate, setFormDate] = useState(today())

  const picoPlaca = data.picoPlaca || {}
  const invActivo = data.inventario.filter(v => v.estado !== 'Vendido')
  const leads = isAdmin ? data.leads : data.leads.filter(l => l.owner === user.nombre)
  const oportunidades = isAdmin ? (data.oportunidades || []) : (data.oportunidades || []).filter(o => o.owner === user.nombre)
  const asesores = data.asesores || ASESORES
  const ownerOptions = isAdmin ? asesores : [user.nombre]

  const todas = (data.citas || []).filter(c => isAdmin || c.owner === user.nombre)
  const [wkStart, wkEnd] = weekRange()
  const hoyN = todas.filter(c => c.fecha === today() && !c.done).length
  const semanaN = todas.filter(c => inRange(c.fecha, wkStart, wkEnd) && !c.done).length

  const enFiltro = c => filtro === 'hoy' ? c.fecha === today() : inRange(c.fecha, wkStart, wkEnd)
  const lista = todas.filter(enFiltro).sort((a, b) => (a.fecha + (a.hora || '') > b.fecha + (b.hora || '') ? 1 : -1))
  const events = todas.map(c => ({ id: c.id, date: c.fecha, label: `${c.hora ? c.hora + ' ' : ''}${c.cliente || c.vehiculo || 'Cita'}`, tone: c.done ? 'done' : (picoPlacaRestringido(c.placa, c.motor, c.fecha, picoPlaca) ? 'red' : 'cyan') }))
  const delDia = todas.filter(c => c.fecha === selDay)

  const pick = f => { setFiltro(f); setVista('lista') }
  function openForm(date) { setEditing(null); setFormDate(date || today()); setShowForm(true) }

  function save(f) {
    const v = data.inventario.find(x => x.id === f.vehiculoId)
    const cliente = data.leads.find(l => l.id === f.clienteId)
    const cita = {
      fecha: f.fecha, hora: f.hora, lugar: f.lugar, nota: f.nota,
      clienteId: f.clienteId, cliente: cliente?.nombre || '',
      vehiculoId: f.vehiculoId, vehiculo: v ? vehName(v) : '', placa: v?.placa || '', motor: v?.motor || '',
      owner: f.owner || user.nombre, done: editing ? editing.done : false,
    }
    if (editing) { updateItem('citas', editing.id, cita); toast('Cita actualizada') }
    else { addItem('citas', cita); toast('Cita programada') }
    setShowForm(false); setEditing(null)
  }

  return (
    <>
      <Topbar title="Citas" sub="Muestras de vehículos a clientes">
        {isAdmin && <button className="btn" onClick={() => setShowConfig(true)}><CalendarClock size={14} /> Pico y placa</button>}
        <button className="btn cyan" onClick={() => openForm(vista === 'calendario' ? selDay : today())}>+ Nueva cita</button>
      </Topbar>
      <Page>
        <div className="kpi-grid mb-16" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 240px))' }}>
          <Kpi label="Hoy" value={hoyN} accent="cyan" onClick={() => pick('hoy')} active={filtro === 'hoy'} />
          <Kpi label="Esta semana" value={semanaN} accent="amber" onClick={() => pick('semana')} active={filtro === 'semana'} />
        </div>

        <div className="filters">
          <div className="seg">
            <button className={vista === 'lista' ? 'on' : ''} onClick={() => setVista('lista')}>Lista</button>
            <button className={vista === 'calendario' ? 'on' : ''} onClick={() => setVista('calendario')}>Calendario</button>
          </div>
        </div>

        {vista === 'calendario' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
            <div className="card"><Calendar events={events} selectedDate={selDay} onSelectDay={setSelDay} /></div>
            <div className="card" style={{ alignSelf: 'start' }}>
              <div className="row between mb-12">
                <span className="section-title" style={{ fontSize: 14 }}>{fmtDate(selDay)}</span>
                <button className="btn cyan sm" onClick={() => openForm(selDay)}>+ Cita</button>
              </div>
              {delDia.map(c => {
                const pp = picoPlacaRestringido(c.placa, c.motor, c.fecha, picoPlaca)
                return (
                  <div key={c.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                    <div className="row between">
                      <span className="cell-strong" style={{ fontSize: 12.5 }}>{c.hora ? c.hora + ' · ' : ''}{c.cliente || '—'}</span>
                      <button className="btn danger sm" onClick={() => confirmDelete('la cita', () => deleteItem('citas', c.id))}>×</button>
                    </div>
                    <div className="text-3" style={{ fontSize: 11.5 }}>{c.vehiculo}{c.placa ? ` · ${c.placa}` : ''} {pp && <Badge tone="red">pico y placa</Badge>}</div>
                  </div>
                )
              })}
              {!delDia.length && <div className="text-3" style={{ fontSize: 12.5, padding: '6px 0' }}>Sin citas este día.</div>}
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>{['', 'Fecha', 'Hora', 'Cliente', 'Vehículo', 'Lugar', 'Pico y placa', ''].map((h, i) => <th key={i}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {lista.map(c => {
                  const pp = picoPlacaRestringido(c.placa, c.motor, c.fecha, picoPlaca)
                  const venc = !c.done && isOverdue(c.fecha)
                  return (
                    <tr key={c.id} style={c.fecha === today() && !c.done ? { background: 'var(--cyan-soft)' } : undefined}>
                      <td><input type="checkbox" checked={!!c.done} onChange={() => updateItem('citas', c.id, { done: !c.done })} title="Marcar realizada" /></td>
                      <td className="num">{fmtDate(c.fecha)} {venc && <Badge tone="red">vencida</Badge>}</td>
                      <td className="num text-2">{c.hora || '—'}</td>
                      <td className="cell-strong" style={c.done ? { textDecoration: 'line-through', color: 'var(--text-3)' } : undefined}>{c.cliente || '—'}</td>
                      <td>{c.vehiculo || '—'}{c.placa ? <span className="text-3"> · {c.placa}</span> : ''}</td>
                      <td className="text-2">{c.lugar || '—'}</td>
                      <td>{pp ? <Badge tone="red" dot>Restringido</Badge> : <Badge tone="green">Sin restricción</Badge>}</td>
                      <td>
                        <Kebab items={[
                          { label: 'Editar', onClick: () => { setEditing(c); setShowForm(true) } },
                          { label: 'Eliminar', danger: true, onClick: () => confirmDelete('la cita', () => deleteItem('citas', c.id)) },
                        ]} />
                      </td>
                    </tr>
                  )
                })}
                {!lista.length && <EmptyRow colSpan={8}><div className="big">Sin citas {filtro === 'hoy' ? 'hoy' : 'esta semana'}</div>Agenda una muestra de vehículo a un cliente.</EmptyRow>}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-3 mt-8" style={{ fontSize: 11.5 }}>Los vehículos híbridos y eléctricos están exentos de pico y placa. Configura los días desde el botón "Pico y placa".</div>
      </Page>

      {showForm && <CitaForm initial={editing} presetFecha={formDate} leads={leads} oportunidades={oportunidades} inventario={invActivo} asesores={ownerOptions} picoPlaca={picoPlaca}
        onSave={save} onClose={() => { setShowForm(false); setEditing(null) }} />}
      {showConfig && <PicoPlacaModal picoPlaca={picoPlaca} onSave={pp => { setField('picoPlaca', pp); toast('Pico y placa actualizado') }} onClose={() => setShowConfig(false)} />}
    </>
  )
}

function CitaForm({ initial, presetFecha, leads, oportunidades, inventario, asesores, picoPlaca, onSave, onClose }) {
  const [form, setForm] = useState(initial
    ? { fecha: initial.fecha, hora: initial.hora || '', clienteId: initial.clienteId || '', vehiculoId: initial.vehiculoId || '', lugar: initial.lugar || '', nota: initial.nota || '', owner: initial.owner }
    : { fecha: presetFecha || today(), hora: '', clienteId: '', vehiculoId: '', lugar: '', nota: '', owner: asesores[0] || 'Simón' })
  const set = (k, v) => setForm({ ...form, [k]: v })
  const veh = inventario.find(v => v.id === form.vehiculoId) || (initial && initial.vehiculoId ? { placa: initial.placa, motor: initial.motor } : null)
  const pp = veh && picoPlacaRestringido(veh.placa, veh.motor, form.fecha, picoPlaca)

  // Sugerir como primeros contactos los interesados en el vehículo elegido
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
