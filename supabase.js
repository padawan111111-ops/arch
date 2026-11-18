// =====================================================================
//  CONEXIÓN CON SUPABASE
//  Estos datos se copian de: Supabase > Project Settings > API
//  - SUPABASE_URL: "Project URL"
//  - SUPABASE_KEY: la llave "anon public" (o "publishable").
//    ¡NUNCA uses la llave "service_role" en el front end!
// =====================================================================
const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_KEY = "TU-LLAVE-ANON-PUBLIC";

// Nombre de la tabla (mi nombre) y del bucket de Storage
const TABLA = "jaime_jared_gonzalez_garcia";
const BUCKET = "documentos";

// La librería de Supabase (cargada desde el CDN en el HTML) crea el
// objeto global "supabase". Con createClient hacemos la conexión.
// El cliente guarda la sesión en el navegador (localStorage), por eso
// el usuario sigue conectado aunque cierre la pestaña.
const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
