import { createClient } from '@supabase/supabase-js'

// Si defines VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en un archivo .env,
// la app guarda y sincroniza los datos en Supabase (tiempo real, compartido
// entre Simón y Roberto). Si NO están definidas, sigue usando localStorage.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (url && key) ? createClient(url, key) : null
export const supabaseEnabled = !!supabase
