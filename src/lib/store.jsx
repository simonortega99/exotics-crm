import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { uid, OPP_STAGES } from './utils.js'
import { supabase } from './supabaseClient.js'
import { toast } from '../components/feedback.jsx'

// ============================================================
// STORE GLOBAL — Exotics Co. HQ
//
// Modelo POR FILAS (a prueba de choques entre usuarios):
//   - Cada registro (contacto, oportunidad, vehículo, etc.) es una
//     fila en la tabla `crm_items` (id, collection, data jsonb).
//   - La configuración (equipo, metas, pico y placa…) va en una
//     única fila `crm_state` id='settings'.
//   Así, cuando Simón y Roberto trabajan a la vez, sus altas/ediciones
//   son operaciones independientes y NO se sobreescriben.
//
// Si la tabla `crm_items` aún no existe, cae al modo anterior (un
// solo bloque en crm_state id='main') para no romper nada.
// Sin Supabase configurado, usa localStorage.
// ============================================================

const STORAGE_KEY = 'exotics_hq_data'

const ARRAY_COLLECTIONS = ['leads', 'oportunidades', 'inventario', 'retomas', 'busquedas', 'ventas', 'actividades', 'fidelidad', 'contenidos', 'finanzas', 'citas']
const SETTINGS_KEYS = ['asesores', 'equipo', 'fidelidadPlantillas', 'fidelidadTipos', 'meta', 'metaAnual', 'metaTipo', 'picoPlaca', 'redes', '_migratedOpps', '_unifiedActivities']

const initialState = {
  leads: [], oportunidades: [], inventario: [], retomas: [], busquedas: [], ventas: [],
  fidelidad: [], actividades: [], citas: [], contenidos: [], finanzas: [],
  picoPlaca: { 1: [], 2: [], 3: [], 4: [], 5: [] },
  asesores: ['Simón', 'Roberto'],
  equipo: [
    { id: 'u1', nombre: 'Simón', usuario: 'simon', password: 'exotics', rol: 'admin' },
    { id: 'u2', nombre: 'Roberto', usuario: 'roberto', password: 'exotics', rol: 'admin' },
  ],
  fidelidadPlantillas: [
    { id: 'p1', titulo: 'Seguimiento post-venta (1 mes)', base: 'compra', meses: 1 },
    { id: 'p2', titulo: 'Seguimiento post-venta (6 meses)', base: 'compra', meses: 6 },
    { id: 'p3', titulo: 'Felicitación de cumpleaños', base: 'cumple', meses: 0 },
  ],
  fidelidadTipos: ['Llamada de cortesía', 'Regalo / aniversario', 'Oferta exclusiva', 'Mantenimiento VIP', 'Encuesta de satisfacción', 'Referido', 'Otro'],
  meta: 8, metaAnual: 96, metaTipo: 'mensual',
  redes: { ig: {}, tt: {} },
  _migratedOpps: false,
}

// Rellena valores por defecto de configuración (idempotente, no toca registros).
function withDefaults(d) {
  const s = { ...initialState, ...d }
  if (!Array.isArray(s.equipo) || !s.equipo.length) s.equipo = initialState.equipo
  s.equipo = s.equipo.map(e => ({ ...e, rol: e.rol || (['Simón', 'Roberto'].includes(e.nombre) ? 'admin' : 'asesor') }))
  s.asesores = s.equipo.map(e => e.nombre)
  if (!s.metaTipo) s.metaTipo = 'mensual'
  if (s.metaAnual == null) s.metaAnual = (s.meta || 8) * 12
  if (!Array.isArray(s.fidelidadPlantillas)) s.fidelidadPlantillas = initialState.fidelidadPlantillas
  if (!Array.isArray(s.fidelidadTipos) || !s.fidelidadTipos.length) s.fidelidadTipos = initialState.fidelidadTipos
  if (!s.picoPlaca || typeof s.picoPlaca !== 'object') s.picoPlaca = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  ARRAY_COLLECTIONS.forEach(c => { if (!Array.isArray(s[c])) s[c] = [] })
  return s
}

// Migración destructiva de una sola vez (para SEMBRAR desde el bloque antiguo).
function migrate(state) {
  const s = withDefaults({ ...state })
  ;(s.leads || []).forEach(l => { if (l.rol === 'concesionario') l.rol = 'aliado' })
  if (!s._migratedOpps) {
    if ((!s.oportunidades || !s.oportunidades.length) && (s.leads || []).length) {
      const activos = s.leads.filter(l => (l.rol || 'lead') === 'lead')
      s.oportunidades = activos.map(l => ({
        id: uid(), contactoId: l.id, contacto: l.nombre, vehiculoInteres: l.vehiculoInteres || '',
        vehiculoId: l.vehiculoId || '', valor: l.valor || '', stage: Math.min(+l.stage || 0, OPP_STAGES.length - 1),
        estado: 'Abierta', owner: l.owner || 'Simón', fecha: l.fecha || new Date().toISOString().split('T')[0],
      }))
    }
    s._migratedOpps = true
  }
  if (!s._unifiedActivities) {
    s.actividades = s.actividades || []
    ;(s.leads || []).forEach(l => {
      ;(l.tasks || []).forEach(t => s.actividades.push({ id: uid(), titulo: t.title, fecha: t.date, tipo: 'Seguimiento', owner: l.owner || 'Simón', lead: l.nombre, leadId: l.id, done: !!t.done }))
      delete l.tasks
    })
    ;(s.fidelidad || []).forEach(f => s.actividades.push({ id: uid(), titulo: f.tipo + (f.nota ? ` · ${f.nota}` : ''), fecha: f.fecha, tipo: 'Fidelización', owner: f.owner || '', lead: f.cliente, cliente: f.cliente, done: !!f.done }))
    s.fidelidad = []
    s._unifiedActivities = true
  }
  return s
}

const readLocal = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} } }

const StoreContext = createContext(null)
const CLIENT_ID = uid()

export function StoreProvider({ children }) {
  const [data, setData] = useState(initialState)
  const [loaded, setLoaded] = useState(false)
  const skipSave = useRef(false)
  const signedIn = useRef(!supabase)
  const mode = useRef(supabase ? 'perrow' : 'local') // perrow | blob | local
  const channelRef = useRef(null)
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])
  const pending = useRef(0)          // escrituras en vuelo (protege la reconciliación)
  const warnedOffline = useRef(false) // evita repetir el aviso de error

  // ---------- helpers de persistencia por fila ----------
  const nowISO = () => new Date().toISOString()

  // Ejecuta una escritura en Supabase con reintentos y backoff. Si tras
  // varios intentos sigue fallando, avisa al usuario (para que no crea que
  // guardó cuando en realidad el dato no llegó a la nube).
  async function withRetry(makeQuery, label, tries = 4) {
    pending.current++
    try {
      for (let i = 0; i < tries; i++) {
        try {
          const { error } = await makeQuery()
          if (!error) { warnedOffline.current = false; return true }
          if (i === tries - 1) throw error
        } catch (e) {
          if (i === tries - 1) {
            console.error(label, e)
            if (!warnedOffline.current) {
              warnedOffline.current = true
              toast('No se pudo guardar en la nube. Revisa tu conexión: el cambio podría perderse al recargar.', 'error')
            }
            return false
          }
        }
        await new Promise(r => setTimeout(r, 500 * (i + 1)))
      }
    } finally {
      pending.current--
    }
    return false
  }

  function pushItem(collection, item) {
    if (mode.current !== 'perrow' || !supabase || !signedIn.current) return
    // En cada intento envía la versión MÁS reciente del registro (evita que un
    // reintento pise una edición posterior con datos viejos).
    withRetry(() => {
      const latest = (dataRef.current[collection] || []).find(x => x.id === item.id) || item
      return supabase.from('crm_items').upsert({ id: item.id, collection, data: latest, updated_at: nowISO() })
    }, 'upsert item')
  }
  function removeRow(id) {
    if (mode.current !== 'perrow' || !supabase || !signedIn.current) return
    withRetry(() => supabase.from('crm_items').delete().eq('id', id), 'delete item')
  }
  function saveSettings(next) {
    if (mode.current !== 'perrow' || !supabase || !signedIn.current) return
    const settings = {}; SETTINGS_KEYS.forEach(k => { settings[k] = next[k] })
    withRetry(() => supabase.from('crm_state').upsert({ id: 'settings', data: settings, updated_at: nowISO() }), 'save settings')
  }

  // ---------- realtime ----------
  function setupRealtime() {
    if (!supabase || channelRef.current) return
    channelRef.current = supabase.channel('crm_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_items' }, payload => {
        if (payload.eventType === 'DELETE') {
          const id = payload.old && payload.old.id
          if (!id) return
          setData(prev => {
            const n = { ...prev }
            for (const c of ARRAY_COLLECTIONS) if (n[c] && n[c].some(x => x.id === id)) n[c] = n[c].filter(x => x.id !== id)
            return n
          })
        } else {
          const r = payload.new
          if (!r || !r.collection) return
          setData(prev => {
            const arr = prev[r.collection] || []
            const exists = arr.some(x => x.id === r.id)
            return { ...prev, [r.collection]: exists ? arr.map(x => x.id === r.id ? r.data : x) : [r.data, ...arr] }
          })
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_state', filter: 'id=eq.settings' }, payload => {
        const s = payload.new && payload.new.data
        if (s) setData(prev => withDefaults({ ...prev, ...s }))
      })
      .subscribe(status => {
        // Al re-suscribirse tras una caída, ponerse al día por si se perdieron eventos.
        if (status === 'SUBSCRIBED' && subscribedOnce.current) reconcile()
        if (status === 'SUBSCRIBED') subscribedOnce.current = true
      })
  }
  const subscribedOnce = useRef(false)

  function clearChannel() { if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null } }

  // ---------- siembra desde el bloque antiguo ----------
  async function seedPerRow() {
    let base = null
    try { const { data: row } = await supabase.from('crm_state').select('data').eq('id', 'main').maybeSingle(); base = row && row.data } catch { /* noop */ }
    if (!base) base = readLocal()
    const blob = migrate(base || {})
    const rows = []
    ARRAY_COLLECTIONS.forEach(c => (blob[c] || []).forEach(it => { if (it && it.id) rows.push({ id: it.id, collection: c, data: it }) }))
    for (let i = 0; i < rows.length; i += 400) {
      try { await supabase.from('crm_items').upsert(rows.slice(i, i + 400)) } catch (e) { console.error('seed items', e) }
    }
    const settings = {}; SETTINGS_KEYS.forEach(k => { if (blob[k] !== undefined) settings[k] = blob[k] })
    try { await supabase.from('crm_state').upsert({ id: 'settings', data: settings, updated_at: nowISO() }) } catch (e) { console.error('seed settings', e) }
  }

  async function loadPerRow() {
    const { data: items, error } = await supabase.from('crm_items').select('id, collection, data')
    if (error) throw error // probablemente la tabla no existe → cae a modo blob
    const { data: srow } = await supabase.from('crm_state').select('data').eq('id', 'settings').maybeSingle()
    if ((!items || items.length === 0) && !srow) {
      await seedPerRow()
      const again = await supabase.from('crm_items').select('id, collection, data')
      const s2 = await supabase.from('crm_state').select('data').eq('id', 'settings').maybeSingle()
      build(again.data || [], (s2.data && s2.data.data) || {})
    } else {
      build(items || [], (srow && srow.data) || {})
    }
    mode.current = 'perrow'
    setupRealtime()
  }
  function build(items, settings) {
    const d = {}; ARRAY_COLLECTIONS.forEach(c => d[c] = [])
    items.forEach(r => { if (r && r.collection) (d[r.collection] = d[r.collection] || []).push(r.data) })
    skipSave.current = true
    setData(withDefaults({ ...d, ...settings }))
  }

  // ---------- modo blob (fallback si crm_items no existe) ----------
  async function loadBlob() {
    mode.current = 'blob'
    const { data: row } = await supabase.from('crm_state').select('data').eq('id', 'main').maybeSingle()
    if (row && row.data) { skipSave.current = true; setData(migrate(row.data)) }
    else { const seeded = migrate(readLocal()); setData(seeded); try { await supabase.from('crm_state').upsert({ id: 'main', data: { ...seeded, _writer: CLIENT_ID }, updated_at: nowISO() }) } catch { /* noop */ } }
    if (!channelRef.current) {
      channelRef.current = supabase.channel('crm_blob')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_state', filter: 'id=eq.main' }, payload => {
          const d = payload.new && payload.new.data
          if (d && d._writer !== CLIENT_ID) { skipSave.current = true; setData(migrate(d)) }
        }).subscribe()
    }
  }

  async function loadRemote() {
    try { await loadPerRow() }
    catch (e) { console.warn('crm_items no disponible, uso modo bloque:', e && e.message); try { await loadBlob() } catch (e2) { console.error(e2); setData(migrate(readLocal())) } }
  }

  // Vuelve a leer la base y se pone al día. Se dispara al reconectar / volver a
  // la pestaña, por si Realtime perdió algún evento. NO corre si hay escrituras
  // pendientes, para no pisar un cambio local aún sin confirmar en la nube.
  const reconciling = useRef(false)
  async function reconcile() {
    if (!supabase || !signedIn.current || pending.current > 0 || reconciling.current) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    reconciling.current = true
    try {
      if (mode.current === 'perrow') {
        const { data: items, error } = await supabase.from('crm_items').select('id, collection, data')
        if (error) return
        const { data: srow } = await supabase.from('crm_state').select('data').eq('id', 'settings').maybeSingle()
        if (pending.current > 0) return // llegó una escritura mientras leíamos
        build(items || [], (srow && srow.data) || {})
      } else if (mode.current === 'blob') {
        const { data: row } = await supabase.from('crm_state').select('data').eq('id', 'main').maybeSingle()
        if (pending.current > 0) return
        if (row && row.data) { skipSave.current = true; setData(migrate(row.data)) }
      }
    } catch (e) { console.warn('reconcile', e && e.message) }
    finally { reconciling.current = false }
  }

  // ---------- carga inicial ----------
  useEffect(() => {
    let cancelled = false
    if (!supabase) { setData(migrate(readLocal())); setLoaded(true); return }

    supabase.auth.getSession().then(async ({ data: s }) => {
      if (cancelled) return
      if (s.session) { signedIn.current = true; await loadRemote() }
      else { setData(withDefaults({})) }
      setLoaded(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'SIGNED_IN' && s) { signedIn.current = true; await loadRemote() }
      if (event === 'SIGNED_OUT') { signedIn.current = false; clearChannel(); setData(withDefaults({})) }
    })

    // Ponerse al día cuando el navegador vuelve al primer plano o recupera red,
    // por si Realtime perdió algún evento mientras tanto.
    const onFocus = () => reconcile()
    const onOnline = () => reconcile()
    const onVisible = () => { if (document.visibilityState === 'visible') reconcile() }
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
      clearChannel()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // ---------- respaldo local + guardado en modo blob ----------
  useEffect(() => {
    if (!loaded) return
    if (skipSave.current) { skipSave.current = false; return }
    if (supabase && !signedIn.current) return
    const t = setTimeout(async () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* noop */ }
      if (mode.current === 'blob' && supabase && signedIn.current) {
        try { await supabase.from('crm_state').upsert({ id: 'main', data: { ...data, _writer: CLIENT_ID }, updated_at: nowISO() }) } catch (e) { console.error(e) }
      }
    }, 400)
    return () => clearTimeout(t)
  }, [data, loaded])

  // ---------- API pública (igual que antes) ----------
  const addItem = useCallback((collection, item) => {
    const created = { id: uid(), ...item }
    setData(prev => ({ ...prev, [collection]: [created, ...(prev[collection] || [])] }))
    pushItem(collection, created)
    return created
  }, [])

  const updateItem = useCallback((collection, id, updates) => {
    const cur = (dataRef.current[collection] || []).find(x => x.id === id)
    const merged = cur ? { ...cur, ...updates } : null
    setData(prev => ({ ...prev, [collection]: (prev[collection] || []).map(x => x.id === id ? { ...x, ...updates } : x) }))
    if (merged) pushItem(collection, merged)
  }, [])

  const deleteItem = useCallback((collection, id) => {
    setData(prev => ({ ...prev, [collection]: (prev[collection] || []).filter(x => x.id !== id) }))
    removeRow(id)
  }, [])

  // Vuelve a insertar un registro (para "deshacer" un borrado), conservando su id.
  const restoreItem = useCallback((collection, item) => {
    setData(prev => {
      const arr = prev[collection] || []
      if (arr.some(x => x.id === item.id)) return prev
      return { ...prev, [collection]: [item, ...arr] }
    })
    pushItem(collection, item)
  }, [])

  // Borra un registro y muestra un aviso con opción de "Deshacer" (lo restaura).
  const deleteItemUndo = useCallback((collection, item, label = 'Elemento') => {
    const snapshot = { ...item }
    setData(prev => ({ ...prev, [collection]: (prev[collection] || []).filter(x => x.id !== item.id) }))
    removeRow(item.id)
    toast(`${label} eliminado`, 'info', { label: 'Deshacer', fn: () => restoreItem(collection, snapshot) })
  }, [restoreItem])

  const setField = useCallback((field, value) => {
    const next = { ...dataRef.current, [field]: value }
    setData(prev => ({ ...prev, [field]: value }))
    if (SETTINGS_KEYS.includes(field)) saveSettings(next)
  }, [])

  const value = { data, setData, addItem, updateItem, deleteItem, restoreItem, deleteItemUndo, setField, loaded }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore debe usarse dentro de StoreProvider')
  return ctx
}
