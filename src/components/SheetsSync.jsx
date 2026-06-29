import { useEffect, useRef } from 'react'
import { useStore } from '../lib/store.jsx'

// Sincroniza Contactos e Inventario hacia un Google Sheet vía un Apps Script
// publicado como Web App. Solo se activa si defines VITE_SHEETS_WEBHOOK_URL
// en el .env. Envía una "foto" completa (debounced) cada vez que cambian.
const URL_ = import.meta.env.VITE_SHEETS_WEBHOOK_URL

function post(body) {
  if (!URL_) return
  try {
    fetch(URL_, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
  } catch (e) { /* silencioso: no debe afectar la app */ }
}

export default function SheetsSync() {
  const { data, loaded } = useStore()
  const timer = useRef()

  useEffect(() => {
    if (!URL_ || !loaded) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      post({ tipo: 'contactos', rows: data.leads || [] })
      post({ tipo: 'inventario', rows: data.inventario || [] })
    }, 2500)
    return () => clearTimeout(timer.current)
  }, [data.leads, data.inventario, loaded])

  return null
}
