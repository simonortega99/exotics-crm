import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { X, MoreVertical } from 'lucide-react'

const vehName = v => v ? `${v.marca} ${v.modelo} ${v.anio || ''}`.trim() : ''

// Marca: usa /logo.png si existe; si no, cae al escudo por defecto.
export function BrandMark({ size = 38 }) {
  const [err, setErr] = useState(false)
  return (
    <div className="mark" style={{ width: size, height: size }}>
      {!err
        ? <img src="/logo.png" alt="Exotics Co." style={{ width: '74%', height: '74%', objectFit: 'contain' }} onError={() => setErr(true)} />
        : (
          <svg width={size * 0.55} height={size * 0.6} viewBox="0 0 24 26" fill="none">
            <path d="M12 1L1 5.5V14C1 19.8 5.9 25 12 27C18.1 25 23 19.8 23 14V5.5L12 1Z" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" fill="none" />
            <path d="M9 12H15M12 9V15" stroke="#13C5F4" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
    </div>
  )
}

// Input numérico con separador de miles (1.000) que guarda el número crudo.
export function NumberInput({ value, onChange, placeholder, prefix = '', style, autoFocus }) {
  const digits = (value === '' || value === undefined || value === null) ? '' : String(value).replace(/[^\d]/g, '')
  const display = digits === '' ? '' : Number(digits).toLocaleString('es-CO')
  return (
    <div style={{ position: 'relative' }}>
      {prefix && <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 13, pointerEvents: 'none' }}>{prefix}</span>}
      <input className="input" inputMode="numeric" placeholder={placeholder} style={{ ...(prefix ? { paddingLeft: 24 } : {}), ...style }} autoFocus={autoFocus}
        value={display} onChange={e => onChange(e.target.value.replace(/[^\d]/g, ''))} />
    </div>
  )
}

// Menú de acciones con botón de 3 puntos (se renderiza en portal para no recortarse).
export function Kebab({ items }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  function toggle(e) {
    e.stopPropagation()
    const r = btnRef.current.getBoundingClientRect()
    const n = items.filter(Boolean).length
    const h = n * 38 + 12 // altura estimada del menú
    const top = (r.bottom + h > window.innerHeight - 8) ? Math.max(8, r.top - h - 5) : r.bottom + 5
    setPos({ top, left: Math.max(8, r.right - 168) })
    setOpen(o => !o)
  }
  return (
    <>
      <button ref={btnRef} className="btn ghost icon" onClick={toggle} aria-label="Acciones"><MoreVertical size={16} /></button>
      {open && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 300 }} onClick={e => { e.stopPropagation(); setOpen(false) }} />
          <div className="kebab-menu" style={{ top: pos.top, left: pos.left }} onClick={e => e.stopPropagation()}>
            {items.filter(Boolean).map((it, i) => (
              <button key={i} className={`kebab-item${it.danger ? ' danger' : ''}`} onClick={() => { setOpen(false); it.onClick() }}>{it.label}</button>
            ))}
          </div>
        </>, document.body)}
    </>
  )
}

// Selector de vehículo de interés con opción "Otro (especificar)"
export function VehiculoInteresSelect({ inventario, value, onChange }) {
  const [otro, setOtro] = useState(!value.vehiculoId && !!value.vehiculoInteres)
  const known = inventario.some(v => v.id === value.vehiculoId)
  // Orden alfabético por marca + modelo
  const invOrdenado = [...inventario].sort((a, b) => `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`, 'es', { sensitivity: 'base' }))

  function pick(e) {
    const val = e.target.value
    if (val === '__otro__') { setOtro(true); onChange({ vehiculoId: '', vehiculoInteres: '' }) }
    else if (val === '') { setOtro(false); onChange({ vehiculoId: '', vehiculoInteres: '' }) }
    else { setOtro(false); const v = inventario.find(x => x.id === val); onChange({ vehiculoId: val, vehiculoInteres: vehName(v) }) }
  }
  const selectVal = otro ? '__otro__' : (value.vehiculoId || '')

  return (
    <>
      <select className="select" value={selectVal} onChange={pick}>
        <option value="">— Ninguno —</option>
        {invOrdenado.map(v => <option key={v.id} value={v.id}>{vehName(v)}{v.placa ? ` · ${v.placa}` : ''}</option>)}
        {value.vehiculoId && !known && <option value={value.vehiculoId}>{value.vehiculoInteres || 'Vehículo'} (no disponible)</option>}
        <option value="__otro__">Otro (especificar)…</option>
      </select>
      {otro && <input className="input" style={{ marginTop: 8 }} placeholder="¿Qué vehículo busca? (fuera de inventario)"
        value={value.vehiculoInteres} onChange={e => onChange({ vehiculoId: '', vehiculoInteres: e.target.value })} autoFocus />}
    </>
  )
}

// ============================================================
// Primitivos de UI compartidos — Exotics Co. HQ
// Centralizan estilos y patrones repetidos en todas las páginas.
// ============================================================

export function Topbar({ title, sub, children }) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <span className="topbar-title">{title}</span>
        {sub && <span className="topbar-sub">{sub}</span>}
      </div>
      {children && <div className="topbar-actions">{children}</div>}
    </div>
  )
}

export function Page({ children, style }) {
  return <div className="page" style={style}>{children}</div>
}

export function Kpi({ label, value, sub, accent, valueClass, to, onClick, active }) {
  const inner = (
    <>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${valueClass ? ' ' + valueClass : ''}`}>{value}</div>
      {sub !== undefined && <div className="kpi-sub">{sub}</div>}
    </>
  )
  const cls = `kpi${accent ? ' accent-' + accent : ''}${(to || onClick) ? ' kpi-link' : ''}${active ? ' kpi-active' : ''}`
  if (to) return <Link to={to} className={cls} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link>
  if (onClick) return <div className={cls} onClick={onClick} style={{ cursor: 'pointer' }}>{inner}</div>
  return <div className={cls}>{inner}</div>
}

export function Card({ title, action, children, className = '', style }) {
  return (
    <div className={`card ${className}`} style={style}>
      {(title || action) && (
        <div className="card-head">
          {title && <span className="card-title">{title}</span>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function Badge({ tone = 'gray', dot = false, children }) {
  return <span className={`badge ${tone}`}>{dot && <span className="d" />}{children}</span>
}

export function Field({ label, children }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      {children}
    </div>
  )
}

export function Modal({ title, onClose, children, footer, width }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={width ? { width } : undefined}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>, document.body)
}

export function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="empty">{children}</td>
    </tr>
  )
}

// Botones estándar de pie de modal
export function ModalButtons({ onClose, onSave, saveLabel = 'Guardar', disabled }) {
  return (
    <>
      <button className="btn" onClick={onClose}>Cancelar</button>
      <button className="btn cyan" onClick={onSave} disabled={disabled}>{saveLabel}</button>
    </>
  )
}
