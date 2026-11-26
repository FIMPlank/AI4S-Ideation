import { liveRoomsFlag } from '../config/site'

/** Build-time Supabase config (GitHub Actions variables / .env.local). Only the publishable key, never a secret. */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_PUBLISHABLE_KEY: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

export const backendConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY)

/** Live rooms are offered when the flag is on and the backend is configured. */
export const liveRoomsEnabled = liveRoomsFlag && backendConfigured
