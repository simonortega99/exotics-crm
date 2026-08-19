import { ML } from '../_ml.js'

// Diagnóstico: confirma qué variables de entorno llegan a la función.
// NO revela ningún secreto: solo presencia y longitud.
export default function handler(req, res) {
  res.status(200).json({
    clientId: ML.clientId,
    redirectUri: ML.redirectUri,
    appUrl: ML.appUrl,
    hasClientSecret: !!process.env.ML_CLIENT_SECRET,
    clientSecretLen: (process.env.ML_CLIENT_SECRET || '').length,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    serviceKeyLen: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length,
    hasSupabaseUrl: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
  })
}
