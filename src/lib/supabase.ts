import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration keys to check
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// Retrieve config from env or localStorage
export function getSupabaseConfig(): SupabaseConfig | null {
  // 1. Check if we have env variables
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (envUrl && envKey && envUrl !== 'YOUR_SUPABASE_URL' && envKey !== 'YOUR_SUPABASE_ANON_KEY') {
    return { url: envUrl, anonKey: envKey };
  }

  // 2. Check localStorage (for dynamic runtime configuration via settings panel)
  if (typeof window !== 'undefined') {
    const localUrl = localStorage.getItem('signage_supabase_url');
    const localKey = localStorage.getItem('signage_supabase_anon_key');
    if (localUrl && localKey) {
      return { url: localUrl, anonKey: localKey };
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
