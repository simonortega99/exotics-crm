// Módulo compartido para la integración con MercadoLibre (solo backend / Vercel).
// Los archivos que empiezan con "_" NO se publican como endpoint.
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const ML = {
  clientId: process.env.ML_CLIENT_ID || '4641417852736977',
  clientSecret: process.env.ML_CLIENT_SECRET,
  redirectUri: process.env.ML_REDIRECT_URI || 'https://exotics-crm.vercel.app/api/ml/callback',
  appUrl: process.env.APP_URL || 'https://exotics-crm.vercel.app',
  authHost: 'https://auth.mercadolibre.com.co', // Colombia (MCO)
  api: 'https://api.mercadolibre.com',
}

// Cliente de Supabase con la llave de servicio (bypassa RLS). SOLO en el backend.
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en Vercel')
  return createClient(url, key, { auth: { persistSession: false } })
}

// ---- Cifrado de los tokens ----
// La llave se deriva del propio ML_CLIENT_SECRET, así no hace falta otra variable.
// Los tokens se guardan cifrados en crm_state (id='ml_auth'); aunque alguien lea
// esa fila desde el CRM, solo verá texto cifrado.
function encKey() { return crypto.createHash('sha256').update(String(ML.clientSecret || 'sin-secret')).digest() }
function encrypt(obj) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', encKey(), iv)
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()])
  return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') }
}
function decrypt(blob) {
  if (!blob || !blob.iv) return null
  const d = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(blob.iv, 'base64'))
  d.setAuthTag(Buffer.from(blob.tag, 'base64'))
  const out = Buffer.concat([d.update(Buffer.from(blob.data, 'base64')), d.final()])
  return JSON.parse(out.toString('utf8'))
}

export async function getAuth(sb) {
  const { data } = await sb.from('crm_state').select('data').eq('id', 'ml_auth').maybeSingle()
  try { return decrypt(data?.data) } catch { return null }
}
export async function saveAuth(sb, auth) {
  await sb.from('crm_state').upsert({ id: 'ml_auth', data: encrypt(auth), updated_at: new Date().toISOString() })
}

// Devuelve un access_token válido, refrescándolo con el refresh_token si está por vencer.
export async function getAccessToken(sb) {
  const auth = await getAuth(sb)
  if (!auth || !auth.refresh_token) throw new Error('No conectado a MercadoLibre')
  const now = Date.now()
  if (auth.access_token && auth.expires_at && now < auth.expires_at - 60000) return auth.access_token
  const body = new URLSearchParams({
    grant_type: 'refresh_token', client_id: ML.clientId, client_secret: ML.clientSecret, refresh_token: auth.refresh_token,
  })
  const r = await fetch(`${ML.api}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body })
  const j = await r.json()
  if (!r.ok || !j.access_token) throw new Error('No se pudo refrescar el token: ' + JSON.stringify(j))
  await saveAuth(sb, {
    user_id: auth.user_id, access_token: j.access_token,
    refresh_token: j.refresh_token || auth.refresh_token,
    expires_at: now + (j.expires_in || 21600) * 1000,
  })
  return j.access_token
}

export async function mlGet(token, path) {
  try {
    const r = await fetch(`${ML.api}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    if (!r.ok) return { _error: r.status }
    return await r.json()
  } catch (e) { return { _error: e.message } }
}

// Guarda una fila en la colección `mlmetrics` de crm_items (la lee el CRM).
export async function putMetric(sb, id, data) {
  await sb.from('crm_items').upsert({ id, collection: 'mlmetrics', data: { id, ...data }, updated_at: new Date().toISOString() })
}
