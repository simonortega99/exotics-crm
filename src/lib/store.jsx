import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { uid, OPP_STAGES } from './utils.js'
import { supabase } from './supabaseClient.js'

// ============================================================
// STORE GLOBAL — Exotics Co. HQ
//
// Persiste en localStorage (cada navegador/persona tiene su
// propia copia). Cuando migren a Supabase, esta es la única
// pieza que hay que tocar: cambiar la carga/guardado para que
// lean/escriban en la base de datos, sin tocar páginas.
// ============================================================

const STORAGE_KEY = 'exotics_hq_data'

const initialState = {
  leads: [],          // directorio de contactos (personas)
  oportunidades: [],  // deals abiertos del pipeline
  inventario: [],
  retomas: [],
  busquedas: [],
  ventas: [],
  fidelidad: [],      // acciones de fidelización (log)
  actividades: [],
  citas: [],          // citas para mostrar vehículos
  picoPlaca: { 1: [], 2: [], 3: [], 4: [], 5: [] }, // dígitos restringidos por día (1=Lun … 5=Vie)
  contenidos: [],
  finanzas: [],
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
  meta: 8,            // meta mensual de ventas
  metaAnual: 96,      // meta anual de ventas
  metaTipo: 'mensual', // (legado, ya no se usa)
  redes: { ig: {}, tt: {} },
  _migratedOpps: false,
}

// Migración suave: si aún no hay oportunidades, crea una por cada
// lead activo conservando su etapa del funnel previo. Idempotente.
function migrate(state) {
  const s = { ...initialState, ...state }
  // Equipo (credenciales) como fuente de los asesores
  if (!Array.isArray(s.equipo) || !s.equipo.length) s.equipo = initialState.equipo
  s.equipo = s.equipo.map(e => ({ ...e, rol: e.rol || (['Simón', 'Roberto'].includes(e.nombre) ? 'admin' : 'asesor') }))
  s.asesores = s.equipo.map(e => e.nombre)
  if (!s.metaTipo) s.metaTipo = 'mensual'
  if (s.metaAnual == null) s.metaAnual = (s.meta || 8) * 12
  if (!Array.isArray(s.fidelidadPlantillas)) s.fidelidadPlantillas = initialState.fidelidadPlantillas
  if (!Array.isArray(s.fidelidadTipos) || !s.fidelidadTipos.length) s.fidelidadTipos = initialState.fidelidadTipos
  if (!Array.isArray(s.citas)) s.citas = []
  if (!s.picoPlaca || typeof s.picoPlaca !== 'object') s.picoPlaca = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  // El rol 'concesionario' se unifica con 'aliado'
  ;(s.leads || []).forEach(l => { if (l.rol === 'concesionario') l.rol = 'aliado' })
  if (!s._migratedOpps) {
    if ((!s.oportunidades || !s.oportunidades.length) && (s.leads || []).length) {
      const activos = s.leads.filter(l => (l.rol || 'lead') === 'lead')
      s.oportunidades = activos.map(l => ({
        id: uid(),
        contactoId: l.id,
        contacto: l.nombre,
        vehiculoInteres: l.vehiculoInteres || '',
        vehiculoId: l.vehiculoId || '',
        valor: l.valor || '',
        stage: Math.min(+l.stage || 0, OPP_STAGES.length - 1),
        estado: 'Abierta',
        owner: l.owner || 'Simón',
        fecha: l.fecha || new Date().toISOString().split('T')[0],
      }))
    }
    s._migratedOpps = true
  }

  // Unificación de la agenda: las tareas de seguimiento de cada lead y las
  // acciones de fidelización pasan a la colección única `actividades`, para
  // que TODO aparezca en el módulo Actividades y su calendario.
  if (!s._unifiedActivities) {
    s.actividades = s.actividades || []
    ;(s.leads || []).forEach(l => {
      ;(l.tasks || []).forEach(t => s.actividades.push({
        id: uid(), titulo: t.title, fecha: t.date, tipo: 'Seguimiento',
        owner: l.owner || 'Simón', lead: l.nombre, leadId: l.id, done: !!t.done,
      }))
      delete l.tasks
    })
    ;(s.fidelidad || []).forEach(f => s.actividades.push({
      id: uid(), titulo: f.tipo + (f.nota ? ` · ${f.nota}` : ''), fecha: f.fecha,
      tipo: 'Fidelización', owner: f.owner || '', lead: f.cliente, cliente: f.cliente, done: !!f.done,
    }))
    s.fidelidad = []
    s._unifiedActivities = true
  }
  return s
}

const StoreContext = createContext(null)
const CLIENT_ID = uid()   // identifica esta pestaña para ignorar sus propios echos
const ROW_ID = 'main'     // un solo registro JSON con todo el estado

export function StoreProvider({ children }) {
  const [data, setData] = useState(initialState)
  const [loaded, setLoaded] = useState(false)
  const skipSave = useRef(false)
  const signedIn = useRef(!supabase) // sin supabase, siempre "activo" (modo local)
  const channelRef = useRef(null)

  function setupRealtime() {
    if (!supabase) return
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    channelRef.current = supabase.channel('crm_state_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_state', filter: `id=eq.${ROW_ID}` }, payload => {
        const d = payload.new && payload.new.data
        if (d && d._writer !== CLIENT_ID) { skipSave.current = true; setData(migrate(d)) }
      })
      .subscribe()
  }

  async function loadRemote() {
    try {
      const { data: row, error } = await supabase.from('crm_state').select('data').eq('id', ROW_ID).maybeSingle()
      if (error) throw error
      if (row && row.data) {
        skipSave.current = true
        setData(migrate(row.data))
      } else {
        let local = {}
        try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) local = JSON.parse(raw) } catch { /* noop */ }
        const seeded = migrate(local)
        setData(seeded)
        await supabase.from('crm_state').upsert({ id: ROW_ID, data: { ...seeded, _writer: CLIENT_ID }, updated_at: new Date().toISOString() })
      }
      setupRealtime()
    } catch (e) {
      console.error('Error cargando de Supabase:', e)
    }
  }

  // Carga inicial
  useEffect(() => {
    let cancelled = false

    if (!supabase) {
      // Modo local (sin Supabase configurado)
      let local = {}
      try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) local = JSON.parse(raw) } catch { /* noop */ }
      setData(migrate(local)); setLoaded(true)
      return
    }

    // Modo Supabase: los datos solo se cargan con sesión iniciada (RLS)
    supabase.auth.getSession().then(async ({ data: s }) => {
      if (cancelled) return
      if (s.session) { signedIn.current = true; await loadRemote() }
      else { setData(migrate({})) }
      setLoaded(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'SIGNED_IN' && s) { signedIn.current = true; skipSave.current = true; await loadRemote() }
      if (event === 'SIGNED_OUT') {
        signedIn.current = false
        if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
        skipSave.current = true; setData(migrate({}))
      }
    })
    return () => { cancelled = true; sub.subscription.unsubscribe(); if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  // Guardado (debounced): Supabase + copia local de respaldo
  useEffect(() => {
    if (!loaded) return
    if (skipSave.current) { skipSave.current = false; return }
    if (supabase && !signedIn.current) return // sin sesión no guardamos (evita pisar el respaldo local)
    const t = setTimeout(async () => {
      if (supabase) {
        try {
          await supabase.from('crm_state').upsert({ id: ROW_ID, data: { ...data, _writer: CLIENT_ID }, updated_at: new Date().toISOString() })
        } catch (e) { console.error('Error guardando en Supabase:', e) }
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* noop */ }
    }, 400)
    return () => clearTimeout(t)
  }, [data, loaded])

  const addItem = useCallback((collection, item) => {
    const created = { id: uid(), ...item }
    setData(prev => ({ ...prev, [collection]: [created, ...prev[collection]] }))
    return created
  }, [])

  const updateItem = useCallback((collection, id, updates) => {
    setData(prev => ({
      ...prev,
      [collection]: prev[collection].map(x => x.id === id ? { ...x, ...updates } : x),
    }))
  }, [])

  const deleteItem = useCallback((collection, id) => {
    setData(prev => ({
      ...prev,
      [collection]: prev[collection].filter(x => x.id !== id),
    }))
  }, [])

  const setField = useCallback((field, value) => {
    setData(prev => ({ ...prev, [field]: value }))
  }, [])

  const value = { data, setData, addItem, updateItem, deleteItem, setField, loaded }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore debe usarse dentro de StoreProvider')
  return ctx
}
