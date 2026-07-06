// ============================================================
// Utilidades compartidas en toda la app
// ============================================================

export const STAGES = ['Nuevo lead', 'Contactado', 'Interesado', 'Negociación', 'Cerrado']
// Etapas del pipeline de oportunidades (deal abierto)
export const OPP_STAGES = ['Nuevo lead', 'Información enviada', 'En proceso de crédito', 'Cita programada', 'Negociación']

// Temperatura automática según la etapa (se puede sobreescribir manualmente)
export function thermoForStage(stage) {
  const s = +stage || 0
  if (s >= 4) return 'caliente'      // Negociación
  if (s >= 2) return 'tibio'         // En proceso de crédito / Cita programada
  return 'frio'                      // Nuevo lead / Información enviada
}
export const TIPOS_VEHICULO = ['Propio', 'Consignación', 'Aliado', 'Retoma']
export const MOTORES = ['Gasolina', 'Híbrido', 'Eléctrico', 'Diésel']
export const DIAS_LV = [['1', 'Lunes'], ['2', 'Martes'], ['3', 'Miércoles'], ['4', 'Jueves'], ['5', 'Viernes']]
export const ESTADOS_VEHICULO = ['Disponible', 'Reservado', 'Vendido']
export const CUENTAS_REDES = ['@exotics_colombia', '@exoticsco_autos', 'Ambas']
export const ROLES = ['lead', 'cliente', 'consignante', 'aliado']
export const ASESORES = ['Simón', 'Roberto']
export const THERMOS = ['frio', 'tibio', 'caliente']
// Color por temperatura: frío azul, tibio amarillo, caliente rojo
export const THERMO_TONE = { frio: 'cyan', tibio: 'amber', caliente: 'red' }

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Id único y estable (evita colisiones si se crean dos en el mismo ms)
let _seq = 0
export function uid() {
  _seq = (_seq + 1) % 100000
  return Date.now().toString(36) + _seq.toString(36) + Math.random().toString(36).slice(2, 6)
}

export function today() {
  return new Date().toISOString().split('T')[0]
}

export function addDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export function fmtDate(d) {
  if (!d) return '—'
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

export function fmtMonthYear(y, m) {
  return `${MESES[m - 1]} ${y}`
}

export function isOverdue(d) {
  return d && d < today()
}

export function daysSince(d) {
  if (!d) return 0
  return Math.max(0, Math.floor((new Date() - new Date(d)) / 86400000))
}

// Devuelve { y, m } (m: 1-12) de una fecha ISO 'YYYY-MM-DD'
export function ymOf(dateStr) {
  if (!dateStr) return null
  const [y, m] = dateStr.split('-')
  return { y: +y, m: +m }
}

export function num(v) {
  const n = +v
  return isNaN(n) ? 0 : n
}

// Rango de fechas inclusivo (ISO 'YYYY-MM-DD'; comparación lexicográfica)
export function inRange(d, from, to) {
  if (!d) return false
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

export function monthRange(y, m) {
  const last = new Date(y, m, 0).getDate()
  const mm = String(m).padStart(2, '0')
  return [`${y}-${mm}-01`, `${y}-${mm}-${String(last).padStart(2, '0')}`]
}

export function yearRange(y) {
  return [`${y}-01-01`, `${y}-12-31`]
}

// Semana actual (lunes a domingo)
export function weekRange() {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7 // lunes = 0
  const mon = new Date(d); mon.setDate(d.getDate() - day)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const iso = x => x.toISOString().slice(0, 10)
  return [iso(mon), iso(sun)]
}

// Year-to-date: 1 de enero hasta hoy
export function ytdRange(y) {
  return [`${y}-01-01`, today()]
}

// Periodo inmediatamente anterior del mismo tamaño (termina el día antes de `from`)
export function prevPeriod([from, to]) {
  if (!from || !to) return [null, null]
  const f = new Date(from), t = new Date(to)
  const days = Math.round((t - f) / 86400000)
  const pt = new Date(f); pt.setDate(pt.getDate() - 1)
  const pf = new Date(pt); pf.setDate(pf.getDate() - days)
  const iso = d => d.toISOString().slice(0, 10)
  return [iso(pf), iso(pt)]
}

// Mismo rango trasladado un año atrás
export function shiftYear([from, to], delta) {
  const sh = s => { const [yy, mm, dd] = s.split('-'); return `${+yy + delta}-${mm}-${dd}` }
  return [from ? sh(from) : from, to ? sh(to) : to]
}

export function fmtRange(from, to) {
  if (!from && !to) return 'Todo'
  return `${from ? fmtDate(from) : '…'} – ${to ? fmtDate(to) : '…'}`
}

// Exporta una tabla a un archivo .xls (Excel/Sheets lo abren directo)
export function exportarHojaXls(filename, titulo, headers, rows) {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<meta charset="utf-8"><h3>${esc(titulo)}</h3><table border="1">`
    + `<tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`
    + rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
    + `</table>`
  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function fmtMoney(n) {
  if (n === '' || n === null || n === undefined || isNaN(+n)) return '—'
  return '$' + Number(+n).toLocaleString('es-CO')
}

// Versión compacta para KPIs grandes ($1.2M / $850K)
export function fmtMoneyShort(n) {
  const v = +n
  if (!v || isNaN(v)) return '$0'
  const abs = Math.abs(v)
  if (abs >= 1e9) return '$' + (v / 1e9).toFixed(abs >= 1e10 ? 0 : 1) + 'B'
  if (abs >= 1e6) return '$' + (v / 1e6).toFixed(abs >= 1e7 ? 0 : 1) + 'M'
  if (abs >= 1e3) return '$' + Math.round(v / 1e3) + 'K'
  return '$' + Math.round(v)
}

export function addMonths(dateStr, n) {
  const d = new Date(dateStr || today())
  d.setMonth(d.getMonth() + (+n || 0))
  return d.toISOString().slice(0, 10)
}

// Fecha del próximo cumpleaños (hoy + días que faltan)
export function nextBirthdayDate(cumpleStr) {
  const ci = cumpleInfo(cumpleStr)
  if (!ci) return null
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + ci.diff)
  return d.toISOString().slice(0, 10)
}

export function cumpleInfo(cumpleStr) {
  if (!cumpleStr) return null
  const now = new Date()
  const parts = cumpleStr.split('-')
  if (parts.length < 3) return null
  const [, m, d] = parts
  let next = new Date(now.getFullYear(), +m - 1, +d)
  next.setHours(0, 0, 0, 0)
  const t = new Date(); t.setHours(0, 0, 0, 0)
  if (next < t) next = new Date(now.getFullYear() + 1, +m - 1, +d)
  return { diff: Math.round((next - t) / 86400000) }
}

// ============================================================
// Pico y placa
// ============================================================
export function ultimoDigitoPlaca(placa) {
  if (!placa) return null
  const m = String(placa).match(/(\d)(?=\D*$)/) // último dígito numérico
  return m ? +m[1] : null
}
export function weekdayOf(fecha) {
  if (!fecha) return null
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() // 0=Dom … 6=Sáb
}
// Devuelve true si la placa tiene pico y placa ese día según la config.
export function picoPlacaRestringido(placa, motor, fecha, config) {
  if (!placa || !fecha) return false
  if (motor === 'Híbrido' || motor === 'Eléctrico') return false // exentos
  const wd = weekdayOf(fecha)
  if (wd < 1 || wd > 5) return false // solo lunes a viernes
  const dig = ultimoDigitoPlaca(placa)
  if (dig == null) return false
  const restr = (config && config[wd]) || []
  return restr.map(Number).includes(dig)
}

const DIA_NOMBRE = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' }

// Días (1=Lun … 5=Vie) en que este vehículo tiene pico y placa según su último
// dígito de placa. Devuelve:
//   'exento' → híbrido/eléctrico (nunca tiene)
//   null     → sin placa o sin configuración para saberlo
//   [2, 4]   → array de días de la semana restringidos (posible vacío)
export function diasPicoPlaca(placa, motor, config) {
  if (motor === 'Híbrido' || motor === 'Eléctrico') return 'exento'
  const dig = ultimoDigitoPlaca(placa)
  if (dig == null || !config) return null
  const dias = []
  for (let wd = 1; wd <= 5; wd++) if ((config[wd] || []).map(Number).includes(dig)) dias.push(wd)
  return dias
}

// [2, 4] → "Martes y Jueves" · [1,3,5] → "Lunes, Miércoles y Viernes"
export function nombresDias(wds) {
  const ns = (wds || []).map(w => DIA_NOMBRE[w]).filter(Boolean)
  if (ns.length <= 1) return ns.join('')
  return ns.slice(0, -1).join(', ') + ' y ' + ns[ns.length - 1]
}

// ============================================================
// Fidelización — nivel según compras y monto acumulado
// ============================================================
export const TIERS = [
  { key: 'Prospecto', min: 0,   color: 'gray',   perk: 'Sin compras registradas' },
  { key: 'Plata',     min: 1,   color: 'cyan',   perk: 'Atención prioritaria post-venta' },
  { key: 'Oro',       min: 2,   color: 'amber',  perk: 'Detalle de aniversario + lavado VIP' },
  { key: 'Platino',   min: 4,   color: 'violet', perk: 'Acceso anticipado a inventario premium' },
]

export function loyaltyTier(compras) {
  let t = TIERS[0]
  for (const tier of TIERS) if (compras >= tier.min) t = tier
  return t
}
