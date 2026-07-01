import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { useAuth } from '../lib/auth.jsx'
import { fmtDate, today, isOverdue, picoPlacaRestringido, DIAS_LV, ASESORES } from '../lib/utils.js'
import { Topbar, Page, Kpi, Field, Modal, ModalButtons, Badge, EmptyRow, Kebab } from '../components/ui.jsx'
import { toast, confirmDelete } from '../components/feedback.jsx'
import { CalendarClock } from 'lucide-react'

const vehName = v => v ? `${v.marca} ${v.modelo} ${v.anio || ''}`.trim() : ''

export default function Citas() {
  const { data, addItem, updateItem, deleteItem, setField } = useStore()
  const { user, isAdmin } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const [verPasadas, setVerPasadas] = useState(false)

  const picoPlaca = data.picoPlaca || {}
  const invActivo = data.inventario.filter(v => v.estado !== 'Vendido')
  const leads = isAdmin ? data.leads : data.leads.filter(l => l.owner === user.nombre)
  const asesores = data.asesores || ASESORES
  const ownerOptions = isAdmin ? asesores : [user.nombre]

  const todas = (data.citas || []).filter(c => isAdmin || c.owner === user.nombre)
  const lista = [...todas]
    .filter(c => verPasadas || !c.done && c.fecha >= today())
    .sort((a, b) => (a.fecha + (a.hora || '') > b.fecha + (b.hora || '') ? 1 : -1))

  const hoy = todas.filter(c => c.fecha === today() && !c.done).length
  const proximas = todas.filter(c => c.fecha >= today() && !c.done).length
  const conPP = todas.filter(c => !c.done && c.fecha >= today() && picoPlacaRestringido(c.placa, c.motor, c.fecha, picoPlaca)).length

  function save(f) {
    const v = data.inventario.find(x => x.id === f.vehiculoId)
    const cliente = data.leads.find(l => l.id === f.clienteId)
    const cita = {
      fecha: f.fecha, hora: f.hora, lugar: f.lugar, nota: f.nota,
      clienteId: f.clienteId, cliente: cliente?.nombre || '',
      vehiculoId: f.vehiculoId, vehiculo: v ? vehName(v) : '', placa: v?.placa || '', motor: v?.motor || '',
      owner: f.owner || user.nombre, done: false,
    }
    if (editing) { updateItem('citas', editing.id, cita); toast('Cita actualizada') }
    else { addItem('citas', cita); toast('Cita programada') }
    setShowForm(false); setEditing(null)
  }

  return (
    <>
      <Topbar title="Citas" sub="Muestras de vehículos a clientes">
        {isAdmin && <button className="btn" onClick={() => setShowConfig(true)}><CalendarClock size={14} /> Pico y placa</button>}
        <button className="btn cyan" onClick={() => { setEditing(null); setShowForm(true) }}>+ Nueva cita</button>
      </Topbar>
      <Page>
        <div className="kpi-grid mb-16">
          <Kpi label="Próximas" value={proximas} accent="cyan" />
          <Kpi label="Para hoy" value={hoy} accent="green" />
          <Kpi label="Con pico y placa" value={conPP} accent="amber" valueClass={conPP ? 'red' : ''} />
        </div>

        <div className="filters">
          <label className="row gap-6 text-2" style={{ fontSize: 12.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={verPasadas} onChange={e => setVerPasadas(e.target.checked)} /> Mostrar pasadas/realizadas
          </label>
        </div>

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
              {!lista.length && <EmptyRow colSpan={8}><div className="big">Sin citas programadas</div>Agenda una muestra de vehículo a un cliente.</EmptyRow>}
            </tbody>
          </table>
        </div>
        <div className="text-3 mt-8" style={{ fontSize: 11.5 }}>Los vehículos híbridos y eléctricos están exentos de pico y placa. Configura los días desde el botón "Pico y placa".</div>
      </Page>

      {showForm && <CitaForm initial={editing} leads={leads} inventario={invActivo} asesores={ownerOptions} picoPlaca={picoPlaca}
        onSave={save} onClose={() => { setShowForm(false); setEditing(null) }} />}
      {showConfig && <PicoPlacaModal picoPlaca={picoPlaca} onSave={pp => { setField('picoPlaca', pp); toast('Pico y placa actualizado') }} onClose={() => setShowConfig(false)} />}
    </>
  )
}

function CitaForm({ initial, leads, inventario, asesores, picoPlaca, onSave, onClose }) {
  const [form, setForm] = useState(initial
    ? { fecha: initial.fecha, hora: initial.hora || '', clienteId: initial.clienteId || '', vehiculoId: initial.vehiculoId || '', lugar: initial.lugar || '', nota: initial.nota || '', owner: initial.owner }
    : { fecha: today(), hora: '', clienteId: '', vehiculoId: '', lugar: '', nota: '', owner: asesores[0] || 'Simón' })
  const set = (k, v) => setForm({ ...form, [k]: v })
  const veh = inventario.find(v => v.id === form.vehiculoId) || (initial && initial.vehiculoId ? { placa: initial.placa, motor: initial.motor } : null)
  const pp = veh && picoPlacaRestringido(veh.placa, veh.motor, form.fecha, picoPlaca)

  return (
    <Modal title={initial ? 'Editar cita' : 'Nueva cita'} onClose={onClose} width={460}
      footer={<ModalButtons onClose={onClose} onSave={() => onSave(form)} disabled={!form.clienteId && !form.vehiculoId} saveLabel={initial ? 'Guardar cambios' : 'Agendar'} />}>
      <div className="form-grid cols-2">
        <Field label="Fecha"><input className="input" type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></Field>
        <Field label="Hora"><input className="input" type="time" value={form.hora} onChange={e => set('hora', e.target.value)} /></Field>
      </div>
      <Field label="Cliente">
        <select className="select" value={form.clienteId} onChange={e => set('clienteId', e.target.value)}>
          <option value="">— Seleccionar contacto —</option>
          {leads.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
      </Field>
      <Field label="Vehículo a mostrar">
        <select className="select" value={form.vehiculoId} onChange={e => set('vehiculoId', e.target.value)}>
          <option value="">— Seleccionar vehículo —</option>
          {inventario.map(v => <option key={v.id} value={v.id}>{vehName(v)}{v.placa ? ` · ${v.placa}` : ''}</option>)}
        </select>
      </Field>
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
