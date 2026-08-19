// Módulo compartido para la integración con MercadoLibre (solo backend / Vercel).
// Los archivos que empiezan con "_" NO se publican como endpoint.
import { createClient } from '@supabase/supabase-js'

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

export async function getAuthRow(sb) {
  const { data } = await sb.from('ml_auth').select('*').eq('id', 'ml').maybeSingle()
  return data || null
}

// Devuelve un access_token válido, refrescándolo con el refresh_token si está por vencer.
export async function getAccessToken(sb) {
  const row = await getAuthRow(sb)
  if (!row || !row.refresh_token) throw new Error('No conectado a MercadoLibre')
  const now = Date.now()
  if (row.access_token && row.expires_at && now < row.expires_at - 60000) return row.access_token
  const body = new URLSearchParams({
    grant_type: 'refresh_token', client_id: ML.clientId, client_secret: ML.clientSecret, refresh_token: row.refresh_token,
  })
  const r = await fetch(`${ML.api}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body })
  const j = await r.json()
  if (!r.ok || !j.access_token) throw new Error('No se pudo refrescar el token: ' + JSON.stringify(j))
  await sb.from('ml_auth').update({
    access_token: j.access_token,
    refresh_token: j.refresh_token || row.refresh_token,
    expires_at: now + (j.expires_in || 21600) * 1000,
    updated_at: new Date().toISOString(),
  }).eq('id', 'ml')
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
