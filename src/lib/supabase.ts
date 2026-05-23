import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration keys to check
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

function isUsableSupabaseConfig(url?: string | null, anonKey?: string | null): url is string {
  if (!url || !anonKey) return false;

  const trimmedUrl = url.trim();
  const trimmedKey = anonKey.trim();

  if (!trimmedKey || trimmedKey === 'YOUR_SUPABASE_ANON_KEY') return false;

  try {
    const parsed = new URL(trimmedUrl);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

// Retrieve config from env or localStorage
export function getSupabaseConfig(): SupabaseConfig | null {
  // 1. Check if we have env variables
  const envUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (isUsableSupabaseConfig(envUrl, envKey)) {
    return { url: envUrl.trim(), anonKey: envKey!.trim() };
  }

  // 2. Check localStorage (for dynamic runtime configuration via settings panel)
  if (typeof window !== 'undefined') {
    const localUrl = localStorage.getItem('signage_supabase_url');
    const localKey = localStorage.getItem('signage_supabase_anon_key');
    if (isUsableSupabaseConfig(localUrl, localKey)) {
      return { url: localUrl.trim(), anonKey: localKey!.trim() };
    }
  }

  return null;
}

let supabaseInstance: SupabaseClient | null = null;
let currentConfigStr = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config) {
    supabaseInstance = null;
    return null;
  }

  const configStr = `${config.url}-${config.anonKey}`;
  if (supabaseInstance && currentConfigStr === configStr) {
    return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false, // We do not need user authentication as this is single-user signage admin
      }
    });
    currentConfigStr = configStr;
    return supabaseInstance;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
}

// Save dynamic credentials
export function saveSupabaseConfig(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    if (url.trim() && anonKey.trim()) {
      localStorage.setItem('signage_supabase_url', url.trim());
      localStorage.setItem('signage_supabase_anon_key', anonKey.trim());
    } else {
      localStorage.removeItem('signage_supabase_url');
      localStorage.removeItem('signage_supabase_anon_key');
    }
    // Force re-initialization
    supabaseInstance = null;
    currentConfigStr = '';
  }
}

// Clear credentials
export function clearSupabaseConfig() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('signage_supabase_url');
    localStorage.removeItem('signage_supabase_anon_key');
    supabaseInstance = null;
    currentConfigStr = '';
  }
}
