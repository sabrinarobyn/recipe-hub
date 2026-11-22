/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. With the key, turns on invite-only accounts. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable (anon) key: safe to ship in the page. */
  readonly VITE_SUPABASE_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
