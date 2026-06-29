import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { fmtMoney, fmtDate, today, num } from '../lib/utils.js'
import { Topbar, Page, Kpi, Field, Modal, ModalButtons, Badge, EmptyRow, NumberInput, Kebab } from '../components/ui.jsx'
import { toast, confirmDelete } from '../components/feedback.jsx'

const ESTADO_TONE = { Buscando: 'cyan', 'En pausa': 'gray', Encontrado: 'green' }
const vehName = v => v ? `${v.marca} ${v.modelo} ${v.anio || ''}`.trim() : ''

export default function Busquedas() {
  const { data, addItem, updateItem, deleteItem } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  function findMatch(b) {
    return data.inventario.find(v =>
      v.estado === 'Disponible' &&
      (b.marcaDeseada || '').trim() &&
      (v.marca || '').toLowerCase().includes((b.marcaDeseada || '').toLowerCase()) &&
      (!b.presupuesto || num(v.precio) <= num(b.presupuesto))
    )
  }
  const nombreDe = b => data.leads.find(l => l.id === b.contactoId)?.nombre || b.contactoNombre || '—'

  function crearOpp(b, match) {
    const contacto = data.leads.find(l => l.id === b.contactoId)
    addItem('oportunidades', {
      contactoId: b.contactoId || '', contacto: contacto?.nombre || b.contactoNombre || '',
      vehiculoId: match.id, vehiculoInteres: vehName(match),
      valor: match.precio || '', stage: 1, estado: 'Abierta', owner: contacto?.owner || 'Simón', fecha: today(),
    })
    if (b.contactoId) updateItem('leads', b.contactoId, { vehiculoId: match.id, vehiculoInteres: vehName(match) })
    updateItem('busquedas', b.id, { estado: 'Encontrado' })
    toast('Oportunidad creada desde el match')
  }

  const busquedas = data.busquedas
  const activas = busquedas.filter(b => b.estado === 'Buscando').length
  const conMatch = busquedas.filter(b => findMatch(b)).length

  return (
    <>
      <Topbar title="Búsquedas activas" sub="Encargos de clientes que buscan un vehículo">
        <button className="btn cyan" onClick={() => setShowForm(true)}>+ Nueva búsqueda</button>
      </Topbar>
      <Page>
        <div className="kpi-grid mb-16">
          <Kpi label="Búsquedas activas" value={activas} accent="cyan" />
          <Kpi label="Con match en inventario" value={conMatch} accent="green" />
          <Kpi label="Total encargos" value={busquedas.length} accent="ink" />
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>{['Contacto', 'Inicio', 'Buscado', 'Presupuesto', 'Estado', 'Match', ''].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {busquedas.map(b => {
                const match = findMatch(b)
                const vinculado = !!b.contactoId
                return (
                  <tr key={b.id}>
                    <td className="cell-strong">
                      {nombreDe(b)} {!vinculado && <Badge tone="amber">sin vincular</Badge>}
                    </td>
                    <td className="num text-2">{b.fechaInicio ? fmtDate(b.fechaInicio) : '—'}</td>
                    <td>{b.marcaDeseada} {b.modeloDeseado}</td>
                    <td className="cell-money">{fmtMoney(b.presupuesto)}</td>
                    <td>
                      <select className="select" style={{ maxWidth: 140 }} value={b.estado} onChange={e => updateItem('busquedas', b.id, { estado: e.target.value })}>
                        <option>Buscando</option><option>En pausa</option><option>Encontrado</option>
                      </select>
                    </td>
                    <td>{match ? <Badge tone="green" dot>{match.marca} {match.modelo}</Badge> : <span className="muted">Sin match</span>}</td>
                    <td>
                      <div className="row gap-6">
                        {match && <button className="btn cyan sm" onClick={() => crearOpp(b, match)} title="Crear oportunidad con este vehículo">+ Oportunidad</button>}
                        <Kebab items={[
                          { label: 'Editar', onClick: () => setEditing(b) },
                          { label: 'Eliminar', danger: true, onClick: () => confirmDelete(`la búsqueda de ${nombreDe(b)}`, () => deleteItem('busquedas', b.id)) },
                        ]} />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!busquedas.length && <EmptyRow colSpan={7}><div className="big">Sin búsquedas activas</div>Registra el encargo de un cliente.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Page>

      {showForm && <BusquedaForm leads={data.leads}
        onSave={f => { addItem('busquedas', { ...f, estado: 'Buscando' }); setShowForm(false); toast('Búsqueda registrada') }}
        onClose={() => setShowForm(false)} />}
      {editing && <BusquedaForm leads={data.leads} initial={editing}
        onSave={f => { updateItem('busquedas', editing.id, f); setEditing(null); toast('Búsqueda actualizada') }}
        onClose={() => setEditing(null)} />}
    </>
  )
}

function BusquedaForm({ leads, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { contactoId: '', contactoNombre: '', marcaDeseada: '', modeloDeseado: '', presupuesto: '', fechaInicio: today() })
  const set = (k, v) => setForm({ ...form, [k]: v })
  const sinContactos = !leads.length

  function pickContacto(id) {
    const l = leads.find(x => x.id === id)
    setForm({ ...form, contactoId: id, contactoNombre: l ? l.nombre : form.contactoNombre })
  }
  const valido = form.contactoId || form.contactoNombre.trim()

  return (
    <Modal title={initial ? 'Editar búsqueda' : 'Nueva búsqueda'} onClose={onClose} width={440}
      footer={<ModalButtons onClose={onClose} onSave={() => onSave(form)} disabled={!valido} saveLabel={initial ? 'Guardar cambios' : 'Guardar'} />}>
      <Field label="Contacto del directorio">
        <select className="select" value={form.contactoId} onChange={e => pickContacto(e.target.value)}>
          <option value="">— Seleccionar contacto —</option>
          {leads.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
      </Field>
      {(sinContactos || !form.contactoId) && (
        <Field label="…o nombre (si aún no está en Contactos)">
          <input className="input" value={form.contactoNombre} onChange={e => set('contactoNombre', e.target.value)} placeholder="Nombre del interesado" />
        </Field>
      )}
      <div className="form-grid cols-2">
        <Field label="Marca deseada"><input className="input" value={form.marcaDeseada} onChange={e => set('marcaDeseada', e.target.value)} /></Field>
        <Field label="Modelo deseado"><input className="input" value={form.modeloDeseado} onChange={e => set('modeloDeseado', e.target.value)} /></Field>
      </div>
      <div className="form-grid cols-2">
        <Field label="Presupuesto máximo"><NumberInput prefix="$" value={form.presupuesto} onChange={v => set('presupuesto', v)} /></Field>
        <Field label="Fecha de inicio"><input className="input" type="date" value={form.fechaInicio || today()} onChange={e => set('fechaInicio', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
