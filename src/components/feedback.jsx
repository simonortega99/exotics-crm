import { useState, useEffect } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

// ============================================================
// Feedback global: toasts + confirmaciones (sin contexto).
// Montar <FeedbackRoot/> una sola vez en App.
//   toast('Guardado')                       → notificación
//   const ok = await confirmDialog({ ... })  → confirmación (promesa)
// ============================================================

let listeners = []
let confirmResolver = null
let seq = 0

function emit(type, payload) { listeners.forEach(l => l(type, payload)) }

export function toast(message, kind = 'success', action = null) {
  // action: { label, fn } para mostrar un botón (ej. "Deshacer")
  emit('toast', { id: ++seq, message, kind, action })
}

export function confirmDialog(opts = {}) {
  return new Promise(resolve => {
    confirmResolver = resolve
    emit('confirm', opts)
  })
}

// Helper de borrado con confirmación + toast
export async function confirmDelete(label, fn) {
  const ok = await confirmDialog({
    title: 'Eliminar',
    message: `¿Seguro que quieres eliminar ${label}? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    danger: true,
  })
  if (ok) { fn(); toast(`${label} eliminado`, 'info') }
}

const ICONS = { success: CheckCircle2, info: Info, error: AlertTriangle }

export function FeedbackRoot() {
  const [toasts, setToasts] = useState([])
  const [confirm, setConfirm] = useState(null)

  useEffect(() => {
    const handler = (type, payload) => {
      if (type === 'toast') {
        setToasts(t => [...t, payload])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== payload.id)), payload.action ? 6000 : 3200)
      } else if (type === 'confirm') {
        setConfirm(payload)
      }
    }
    listeners.push(handler)
    return () => { listeners = listeners.filter(l => l !== handler) }
  }, [])

  function answer(val) {
    setConfirm(null)
    if (confirmResolver) { confirmResolver(val); confirmResolver = null }
  }

  useEffect(() => {
    if (!confirm) return
    const onKey = e => { if (e.key === 'Escape') answer(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm])

  return (
    <>
      <div className="toast-wrap">
        {toasts.map(t => {
          const Icon = ICONS[t.kind] || Info
          return (
            <div key={t.id} className={`toast ${t.kind}`}>
              <Icon size={16} />
              <span>{t.message}</span>
              {t.action && (
                <button className="toast-action" onClick={() => { t.action.fn(); setToasts(ts => ts.filter(x => x.id !== t.id)) }}>
                  {t.action.label}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {confirm && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) answer(false) }}>
          <div className="modal" style={{ width: 400 }}>
            <div className="modal-header">
              <span className="modal-title">{confirm.title || 'Confirmar'}</span>
              <button className="btn ghost icon" onClick={() => answer(false)} aria-label="Cerrar"><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p className="text-2" style={{ fontSize: 13.5, lineHeight: 1.5 }}>{confirm.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => answer(false)}>{confirm.cancelLabel || 'Cancelar'}</button>
              <button className={confirm.danger ? 'btn danger-solid' : 'btn cyan'} onClick={() => answer(true)}>
                {confirm.confirmLabel || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
