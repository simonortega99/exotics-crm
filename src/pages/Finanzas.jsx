import { useState, useMemo } from 'react'
import { useStore } from '../lib/store.jsx'
import { fmtMoney, fmtMoneyShort, today, num, ymOf } from '../lib/utils.js'
import { Topbar, Page, Kpi, Field, Modal, ModalButtons, Badge, EmptyRow } from '../components/ui.jsx'
import { toast, confirmDelete } from '../components/feedback.jsx'

const TIPO_TONE = { Ingreso: 'green', Egreso: 'red', 'Reembolso pendiente': 'amber' }

export default function Finanzas() {
  const { data, addItem, updateItem, deleteItem } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [persona, setPersona] = useState('todos')
  const [rango, setRango] = useState('todo') // todo | mes | anio

  const now = new Date()
  const curY = now.getFullYear(), curM = now.getMonth() + 1

  const filtrado = useMemo(() => {
    return data.finanzas.filter(f => {
      if (persona !== 'todos' && f.persona !== persona) return false
      if (rango === 'todo') return true
      const ym = ymOf(f.fecha); if (!ym) return false
      if (rango === 'anio') return ym.y === curY
      return ym.y === curY && ym.m === curM // mes
    })
  }, [data.finanzas, persona, rango, curY, curM])

  const ingresos = filtrado.filter(f => f.tipo === 'Ingreso').reduce((a, f) => a + num(f.monto), 0)
  const egresos = filtrado.filter(f => f.tipo === 'Egreso').reduce((a, f) => a + num(f.monto), 0)
  const pendiente = filtrado.filter(f => f.tipo === 'Reembolso pendiente').reduce((a, f) => a + num(f.monto), 0)
  const balance = ingresos - egresos

  return (
    <>
      <Topbar title="Finanzas" sub="Ingresos, egresos y balance">
        <button className="btn cyan" onClick={() => setShowForm(true)}>+ Nuevo registro</button>
      </Topbar>
      <Page>
        <div className="filters">
          <div className="seg">
            {['todos', 'Simón', 'Roberto', 'Empresa'].map(p => (
              <button key={p} className={persona === p ? 'on' : ''} onClick={() => setPersona(p)}>{p === 'todos' ? 'Todos' : p}</button>
            ))}
          </div>
          <div className="seg">
            {[['todo', 'Histórico'], ['anio', 'Este año'], ['mes', 'Este mes']].map(([k, l]) => (
              <button key={k} className={rango === k ? 'on' : ''} onClick={() => setRango(k)}>{l}</button>
            ))}
          </div>
        </div>

        <div className="kpi-grid mb-16">
          <Kpi label="Ingresos" value={fmtMoneyShort(ingresos)} valueClass="green" accent="green" sub={fmtMoney(ingresos)} />
          <Kpi label="Egresos" value={fmtMoneyShort(egresos)} valueClass="red" accent="amber" sub={fmtMoney(egresos)} />
          <Kpi label="Balance" value={fmtMoneyShort(balance)} valueClass={balance >= 0 ? 'green' : 'red'} accent={balance >= 0 ? 'green' : 'amber'} sub={fmtMoney(Math.abs(balance))} />
          <Kpi label="Reembolsos pendientes" value={fmtMoneyShort(pendiente)} accent="violet" sub={fmtMoney(pendiente)} />
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>{['Fecha', 'Tipo', 'Descripción', 'Monto', 'Persona', ''].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtrado.map(f => (
                <tr key={f.id}>
                  <td>
                    <input type="date" className="inline-date" value={f.fecha || ''}
                      onChange={e => updateItem('finanzas', f.id, { fecha: e.target.value })} title="Editar fecha" />
                  </td>
                  <td><Badge tone={TIPO_TONE[f.tipo] || 'gray'}>{f.tipo}</Badge></td>
                  <td className="cell-strong">{f.descripcion}</td>
                  <td className={`cell-money ${f.tipo === 'Ingreso' ? 't-green' : f.tipo === 'Egreso' ? 't-red' : ''}`}>{fmtMoney(f.monto)}</td>
                  <td className="text-2">{f.persona}</td>
                  <td><button className="btn danger sm" onClick={() => confirmDelete('el registro', () => deleteItem('finanzas', f.id))}>Eliminar</button></td>
                </tr>
              ))}
              {!filtrado.length && <EmptyRow colSpan={6}><div className="big">Sin registros</div>Ajusta el filtro o crea un nuevo registro.</EmptyRow>}
            </tbody>
          </table>
        </div>
        <div className="text-3 mt-8" style={{ fontSize: 11.5 }}>Tip: haz clic en cualquier fecha de la tabla para editarla manualmente.</div>
      </Page>

      {showForm && <FinForm onSave={f => { addItem('finanzas', { ...f, monto: num(f.monto) }); setShowForm(false); toast('Registro guardado') }} onClose={() => setShowForm(false)} />}
    </>
  )
}

function FinForm({ onSave, onClose }) {
  const [form, setForm] = useState({ fecha: today(), tipo: 'Ingreso', persona: 'Empresa', monto: '', descripcion: '' })
  const set = (k, v) => setForm({ ...form, [k]: v })
  return (
    <Modal title="Nuevo registro financiero" onClose={onClose} width={420}
      footer={<ModalButtons onClose={onClose} onSave={() => onSave(form)} disabled={!form.monto || !form.descripcion.trim()} />}>
      <div className="form-grid cols-2">
        <Field label="Fecha"><input className="input" type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></Field>
        <Field label="Tipo">
          <select className="select" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
            <option>Ingreso</option><option>Egreso</option><option>Reembolso pendiente</option>
          </select>
        </Field>
      </div>
      <div className="form-grid cols-2">
        <Field label="Persona">
          <select className="select" value={form.persona} onChange={e => set('persona', e.target.value)}>
            <option>Simón</option><option>Roberto</option><option>Empresa</option>
          </select>
        </Field>
        <Field label="Monto"><input className="input" value={form.monto} onChange={e => set('monto', e.target.value)} /></Field>
      </div>
      <Field label="Descripción"><input className="input" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} /></Field>
    </Modal>
  )
}
