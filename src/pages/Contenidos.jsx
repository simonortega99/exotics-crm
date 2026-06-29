import { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { fmtDate, today, CUENTAS_REDES } from '../lib/utils.js'
import { Topbar, Page, Kpi, Field, Modal, ModalButtons, Badge, EmptyRow } from '../components/ui.jsx'
import Calendar from '../components/Calendar.jsx'
import { toast, confirmDelete } from '../components/feedback.jsx'

const ESTADO_TONE = { Idea: 'gray', 'En producción': 'amber', Publicado: 'green' }
const CAL_TONE = { Idea: 'violet', 'En producción': 'amber', Publicado: 'green' }
const TIPOS = ['Reel', 'Carrusel', 'Story', 'Post', 'Video']

export default function Contenidos() {
  const { data, addItem, updateItem, deleteItem } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [vista, setVista] = useState('lista')
  const [selDay, setSelDay] = useState(today())
  const [formDate, setFormDate] = useState(today())

  const ordenados = [...(data.contenidos || [])].sort((a, b) => (a.fecha > b.fecha ? 1 : -1))
  const enProd = ordenados.filter(p => p.estado === 'En producción').length
  const publicados = ordenados.filter(p => p.estado === 'Publicado').length
  const events = ordenados.map(p => ({ id: p.id, date: p.fecha, label: `${p.tipo} · ${p.titulo}`, tone: CAL_TONE[p.estado] || 'violet' }))
  const delDia = ordenados.filter(p => p.fecha === selDay)

  function openForm(date) { setFormDate(date || today()); setShowForm(true) }
  function save(f) { addItem('contenidos', f); setShowForm(false); toast('Post programado') }

  return (
    <>
      <Topbar title="Calendario de contenidos" sub="Planificación de redes sociales">
        <button className="btn cyan" onClick={() => openForm(vista === 'calendario' ? selDay : today())}>+ Nuevo post</button>
      </Topbar>
      <Page>
        <div className="kpi-grid mb-16">
          <Kpi label="En el calendario" value={ordenados.length} accent="cyan" />
          <Kpi label="En producción" value={enProd} accent="amber" />
          <Kpi label="Publicados" value={publicados} accent="green" />
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
                <button className="btn cyan sm" onClick={() => openForm(selDay)}>+ Post</button>
              </div>
              {delDia.map(p => (
                <div key={p.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                  <div className="row between">
                    <span className="cell-strong" style={{ fontSize: 12.5 }}>{p.titulo}</span>
                    <button className="btn danger sm" onClick={() => confirmDelete('el post', () => deleteItem('contenidos', p.id))}>×</button>
                  </div>
                  <div className="row gap-6 mt-8">
                    <Badge tone="ink">{p.tipo}</Badge><Badge tone={ESTADO_TONE[p.estado]}>{p.estado}</Badge>
                    <span className="text-3" style={{ fontSize: 11 }}>{p.cuenta}</span>
                  </div>
                </div>
              ))}
              {!delDia.length && <div className="text-3" style={{ fontSize: 12.5, padding: '6px 0' }}>Sin posts este día.</div>}
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>{['Fecha', 'Cuenta', 'Tipo', 'Título', 'Estado', ''].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {ordenados.map(p => (
                  <tr key={p.id}>
                    <td className="num">{fmtDate(p.fecha)}</td>
                    <td className="text-2">{p.cuenta}</td>
                    <td><Badge tone="ink">{p.tipo}</Badge></td>
                    <td className="cell-strong">{p.titulo}</td>
                    <td>
                      <select className="select" style={{ maxWidth: 150 }} value={p.estado} onChange={e => updateItem('contenidos', p.id, { estado: e.target.value })}>
                        {['Idea', 'En producción', 'Publicado'].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><button className="btn danger sm" onClick={() => confirmDelete('el post', () => deleteItem('contenidos', p.id))}>Eliminar</button></td>
                  </tr>
                ))}
                {!ordenados.length && <EmptyRow colSpan={6}><div className="big">Sin posts programados</div>Planifica tu primer contenido.</EmptyRow>}
              </tbody>
            </table>
          </div>
        )}
      </Page>

      {showForm && <PostForm initialFecha={formDate} onSave={save} onClose={() => setShowForm(false)} />}
    </>
  )
}

function PostForm({ initialFecha, onSave, onClose }) {
  const [form, setForm] = useState({ titulo: '', fecha: initialFecha || today(), cuenta: CUENTAS_REDES[0], tipo: 'Reel', estado: 'Idea' })
  const set = (k, v) => setForm({ ...form, [k]: v })
  return (
    <Modal title="Nuevo post" onClose={onClose} width={420}
      footer={<ModalButtons onClose={onClose} onSave={() => onSave(form)} disabled={!form.titulo.trim()} />}>
      <Field label="Título / concepto"><input className="input" value={form.titulo} onChange={e => set('titulo', e.target.value)} autoFocus /></Field>
      <div className="form-grid cols-2">
        <Field label="Fecha"><input className="input" type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></Field>
        <Field label="Cuenta">
          <select className="select" value={form.cuenta} onChange={e => set('cuenta', e.target.value)}>{CUENTAS_REDES.map(c => <option key={c}>{c}</option>)}</select>
        </Field>
      </div>
      <div className="form-grid cols-2">
        <Field label="Tipo">
          <select className="select" value={form.tipo} onChange={e => set('tipo', e.target.value)}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Estado">
          <select className="select" value={form.estado} onChange={e => set('estado', e.target.value)}>{['Idea', 'En producción', 'Publicado'].map(s => <option key={s}>{s}</option>)}</select>
        </Field>
      </div>
    </Modal>
  )
}
