import { useState, useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { OPP_STAGES, ASESORES, THERMO_TONE, thermoForStage, fmtMoney, fmtRange, today, addDays, num, inRange } from '../lib/utils.js'
import { Topbar, Page, Kpi, Field, Modal, ModalButtons, Badge, EmptyRow, VehiculoInteresSelect, NumberInput, Kebab } from '../components/ui.jsx'
import { toast, confirmDelete } from '../components/feedback.jsx'
import { useAuth } from '../lib/auth.jsx'

const ESTADO_TONE = { Abierta: 'cyan', Ganada: 'green', Perdida: 'red' }
const THERMO = THERMO_TONE
const THERMO_COLOR = { frio: 'var(--cyan-700)', tibio: 'var(--amber)', caliente: 'var(--green)' }
const FILTROS = [
  { k: 'abiertas', label: 'Abiertas' },
  { k: 'caliente', label: 'Calientes' },
  { k: 'tibio', label: 'Tibios' },
  { k: 'frio', label: 'Fríos' },
  { k: 'cerradas', label: 'Cerradas' },
]

export default function Oportunidades() {
  const { data, addItem, updateItem, deleteItem } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [tareaOpp, setTareaOpp] = useState(null)
  const [filtro, setFiltro] = useState('abiertas')
  const [ownerFilter, setOwnerFilter] = useState('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const { user, isAdmin } = useAuth()
  const asesores = data.asesores || ASESORES
  const ownerOptions = isAdmin ? asesores : [user.nombre]

  const allOps = data.oportunidades || []
  const ops = isAdmin ? allOps : allOps.filter(o => o.owner === user.nombre)
  const visibleLeads = isAdmin ? data.leads : data.leads.filter(l => l.owner === user.nombre)
  const invActivo = data.inventario.filter(v => v.estado !== 'Vendido')
  const thermoOf = o => data.leads.find(l => l.id === o.contactoId)?.thermo
  const enRango = o => (!desde && !hasta) || inRange(o.fecha, desde || null, hasta || null)
  const abiertas = ops.filter(o => o.estado === 'Abierta' && enRango(o))

  const filtered = useMemo(() => {
    let base = filtro === 'cerradas' ? ops.filter(o => o.estado !== 'Abierta')
      : filtro === 'abiertas' ? abiertas
      : abiertas.filter(o => (thermoOf(o) || 'frio') === filtro)
    if (ownerFilter !== 'todos') base = base.filter(o => o.owner === ownerFilter)
    return base.filter(enRango)
  }, [ops, filtro, ownerFilter, desde, hasta, data.leads])

  function perder(o) {
    updateItem('oportunidades', o.id, { estado: 'Perdida' })
    toast('Marcada como perdida', 'info', { label: 'Deshacer', fn: () => updateItem('oportunidades', o.id, { estado: 'Abierta' }) })
  }

  const porTemp = t => abiertas.filter(o => thermoOf(o) === t).length
  const calientes = porTemp('caliente'), tibios = porTemp('tibio'), frios = porTemp('frio')
  const ganadas = ops.filter(o => o.estado === 'Ganada' && enRango(o)).length

  function ganar(o) {
    updateItem('oportunidades', o.id, { estado: 'Ganada' })
    if (o.contactoId) updateItem('leads', o.contactoId, { rol: 'cliente' })
    toast(`Oportunidad ganada: ${o.contacto}`)
  }
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
          <Kpi label="Calientes" value={calientes} accent="green" valueClass="green" />
          <Kpi label="Tibios" value={tibios} accent="amber" />
          <Kpi label="Fríos" value={frios} accent="cyan" valueClass="cyan" />
          <Kpi label="Ganadas" value={ganadas} accent="green" />
        </div>

        <div className="filters">
          <div className="seg">
            {FILTROS.map(f => <button key={f.k} className={filtro === f.k ? 'on' : ''} onClick={() => setFiltro(f.k)}>{f.label}</button>)}
          </div>
          {isAdmin && (
            <select className="select" style={{ width: 150 }} value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
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
              <tr>{['Contacto', 'Temp.', 'Vehículo de interés', 'Valor est.', 'Etapa', 'Estado', ''].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const thermo = thermoOf(o)
                return (
                  <tr key={o.id}>
                    <td><div className="cell-strong">{o.contacto || '—'}</div><div className="text-3" style={{ fontSize: 11 }}>{o.owner}</div></td>
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
                    <td>
                      <div className="row gap-6">
                        {o.estado === 'Abierta' && <button className="btn cyan sm" onClick={() => ganar(o)}>Ganar</button>}
                        <Kebab items={[
                          o.contactoId && { label: 'Agendar tarea', onClick: () => setTareaOpp(o) },
                          o.estado === 'Abierta' && { label: 'Editar', onClick: () => setEditing(o) },
                          o.estado === 'Abierta'
                            ? { label: 'Marcar perdida', onClick: () => perder(o) }
                            : { label: 'Reabrir', onClick: () => { updateItem('oportunidades', o.id, { estado: 'Abierta' }); toast('Oportunidad reabierta') } },
                          { label: 'Eliminar', danger: true, onClick: () => confirmDelete('la oportunidad', () => deleteItem('oportunidades', o.id)) },
                        ]} />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!filtered.length && <EmptyRow colSpan={7}><div className="big">Sin oportunidades</div>Crea una desde aquí o desde la ficha de un contacto.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Page>

      {showForm && <OppForm leads={visibleLeads} asesores={ownerOptions} inventario={invActivo}
        onSave={f => { addItem('oportunidades', f); if (f.contactoId) updateItem('leads', f.contactoId, { thermo: thermoForStage(f.stage) }); setShowForm(false); toast('Oportunidad creada') }} onClose={() => setShowForm(false)} />}
      {editing && <OppEditForm op={editing} asesores={ownerOptions} inventario={invActivo}
        onSave={updates => { updateItem('oportunidades', editing.id, updates); if (editing.contactoId) updateItem('leads', editing.contactoId, { thermo: thermoForStage(updates.stage) }); setEditing(null); toast('Oportunidad actualizada') }} onClose={() => setEditing(null)} />}
      {tareaOpp && <TareaModal opp={tareaOpp}
        onSave={f => { addItem('actividades', { titulo: f.titulo, fecha: f.fecha, tipo: 'Seguimiento', owner: tareaOpp.owner || 'Simón', lead: tareaOpp.contacto, leadId: tareaOpp.contactoId, done: false }); setTareaOpp(null); toast('Tarea agendada · visible en Actividades') }}
        onClose={() => setTareaOpp(null)} />}
    </>
  )
}

function OppForm({ leads, asesores, inventario, onSave, onClose }) {
  const [form, setForm] = useState({ contactoId: '', vehiculoId: '', vehiculoInteres: '', valor: '', stage: 0, owner: asesores[0] || 'Simón', financiacion: false })
  const set = (k, v) => setForm({ ...form, [k]: v })

  function save() {
    const contacto = leads.find(l => l.id === form.contactoId)
    onSave({
      contactoId: form.contactoId, contacto: contacto?.nombre || '',
      vehiculoId: form.vehiculoId, vehiculoInteres: form.vehiculoInteres,
      valor: form.valor, stage: +form.stage, estado: 'Abierta', financiacion: form.financiacion,
      owner: form.owner, fecha: today(),
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
        <Field label="Financiación">
          <label className="row gap-8" style={{ height: 38, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.financiacion} onChange={e => set('financiacion', e.target.checked)} /> Solicita financiación
          </label>
        </Field>
      </div>
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
    valor: op.valor || '', stage: +op.stage || 0, owner: op.owner || 'Simón', financiacion: !!op.financiacion,
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
        <Field label="Financiación">
          <label className="row gap-8" style={{ height: 38, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.financiacion} onChange={e => set('financiacion', e.target.checked)} /> Solicita financiación
          </label>
        </Field>
      </div>
    </Modal>
  )
}
