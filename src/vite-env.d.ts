/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del proyecto Supabase (pública). Sin ella la app funciona solo en el dispositivo. */
  readonly VITE_SUPABASE_URL?: string;
  /** Clave pública (anon / publishable) del proyecto Supabase. Nunca la clave service_role. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
